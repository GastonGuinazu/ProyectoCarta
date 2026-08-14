import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaFileType, MediaRole, MediaVariantPurpose } from '@prisma/client';
import { TenantContextService } from '../core';
import { BranchService } from '../tenant/branch/branch.service';
import { TenantService } from '../tenant/tenant.service';
import type { ProductMediaSlot } from './dto/upload-product-media-query.dto';
import {
  assertFileSize,
  classifyUploadFile,
} from './media-file.classifier';
import {
  LinkedBranchNotFoundException,
  LinkedComboNotFoundException,
  LinkedProductNotFoundException,
  MediaSlotTypeMismatchException,
  MissingMediaFileException,
  StorageQuotaExceededException,
} from './media.exceptions';
import { MediaRepository } from './media.repository';
import type { ResolvedMediaAsset } from './media.types';
import { SupabaseStorageService } from './supabase-storage.service';
import type { MediaAssetRow } from './media-asset-row.type';

export interface ProductMediaUploadResult {
  readonly id: string;
  readonly publicUrl: string;
  readonly fileType: MediaFileType;
  readonly fileName: string;
  readonly role: MediaRole;
}

export interface ComboImageUploadResult {
  readonly id: string;
  readonly publicUrl: string;
  readonly fileName: string;
}

export interface BrandingUploadResult {
  readonly id: string;
  readonly publicUrl: string;
  readonly fileName: string;
  readonly slot: 'logo' | 'banner';
}

@Injectable()
export class MediaService {
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly tenantService: TenantService,
    private readonly branchService: BranchService,
    private readonly storage: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  async resolveMediaAssets(
    assetIds: readonly string[],
  ): Promise<ReadonlyMap<string, ResolvedMediaAsset>> {
    const uniqueAssetIds = [...new Set(assetIds)];
    if (uniqueAssetIds.length === 0) {
      return new Map();
    }

    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const assets = await this.mediaRepository.findByIds(tenantId, uniqueAssetIds);

    return new Map(assets.map((asset) => [asset.id, toResolvedMediaAsset(asset)]));
  }

  async uploadProductMedia(
    productId: string,
    file: Express.Multer.File | undefined,
    uploadedByUserId: string,
    slot: ProductMediaSlot,
  ): Promise<ProductMediaUploadResult> {
    if (!file?.buffer || file.size <= 0) {
      throw new MissingMediaFileException();
    }

    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existingProductId = await this.mediaRepository.findProductId(
      tenantId,
      productId,
    );
    if (!existingProductId) {
      throw new LinkedProductNotFoundException();
    }

    const classified = classifyUploadFile(file.originalname);
    const expectedKind = slot === 'presentation' ? 'image' : 'model3d';
    if (classified.kind !== expectedKind) {
      throw new MediaSlotTypeMismatchException(slot);
    }

    assertFileSize(
      classified.kind,
      file.size,
      this.byteLimit('MEDIA_IMAGE_MAX_BYTES', 10 * 1024 * 1024),
      this.byteLimit('MEDIA_MODEL_MAX_BYTES', 50 * 1024 * 1024),
    );

    await this.assertStorageQuota(tenantId, file.size);

    const stored = await this.storage.uploadTenantProductFile({
      tenantId,
      productId,
      originalName: file.originalname,
      body: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
    });

    try {
      const asset = await this.mediaRepository.upsertProductMediaSlot({
        tenantId,
        productId,
        uploadedByUserId,
        fileType: classified.fileType,
        originalUrl: stored.publicUrl,
        fileSizeBytes: file.size,
        role: slot === 'presentation' ? 'PRIMARY' : 'AR_MODEL',
      });

      await this.removeReplacedFiles(asset.replacedUrls);

      return {
        id: asset.id,
        publicUrl: asset.originalUrl,
        fileType: asset.fileType,
        fileName: file.originalname,
        role: asset.role,
      };
    } catch (error: unknown) {
      await this.storage.remove(stored.path);
      throw error;
    }
  }

  async uploadBranchBranding(
    slot: 'logo' | 'banner',
    file: Express.Multer.File | undefined,
    uploadedByUserId: string,
  ): Promise<BrandingUploadResult> {
    if (!file?.buffer || file.size <= 0) {
      throw new MissingMediaFileException();
    }

    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const classified = classifyUploadFile(file.originalname);
    if (classified.kind !== 'image') {
      throw new MediaSlotTypeMismatchException('presentation');
    }

    assertFileSize(
      'image',
      file.size,
      this.byteLimit('MEDIA_IMAGE_MAX_BYTES', 10 * 1024 * 1024),
      this.byteLimit('MEDIA_MODEL_MAX_BYTES', 50 * 1024 * 1024),
    );

    const contextBranchId = this.tenantContextService.getBranchId();
    const branchId =
      contextBranchId ?? (await this.branchService.findPrimaryId(tenantId));
    if (!branchId) {
      throw new LinkedBranchNotFoundException();
    }

    await this.assertStorageQuota(tenantId, file.size);

    const stored = await this.storage.uploadTenantBrandingFile({
      tenantId,
      branchId,
      originalName: file.originalname,
      body: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
    });

    try {
      const asset = await this.mediaRepository.createImageAsset({
        tenantId,
        uploadedByUserId,
        originalUrl: stored.publicUrl,
        fileSizeBytes: file.size,
      });

      const detached =
        slot === 'logo'
          ? await this.tenantService.attachLogo(tenantId, asset.id)
          : await this.branchService.attachBanner(tenantId, branchId, asset.id);

      if (detached) {
        const removedUrl = await this.mediaRepository.deleteIfUnreferenced(
          tenantId,
          detached.id,
        );
        if (removedUrl) {
          await this.removeReplacedFiles([removedUrl]);
        }
      }

      return {
        id: asset.id,
        publicUrl: asset.originalUrl,
        fileName: file.originalname,
        slot,
      };
    } catch (error: unknown) {
      await this.storage.remove(stored.path);
      throw error;
    }
  }

  async deleteBranchBranding(slot: 'logo' | 'banner'): Promise<void> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const contextBranchId = this.tenantContextService.getBranchId();
    const branchId =
      contextBranchId ?? (await this.branchService.findPrimaryId(tenantId));
    if (!branchId) {
      throw new LinkedBranchNotFoundException();
    }

    const detached =
      slot === 'logo'
        ? await this.tenantService.detachLogo(tenantId)
        : await this.branchService.detachBanner(tenantId, branchId);

    if (!detached) {
      return;
    }

    const removedUrl = await this.mediaRepository.deleteIfUnreferenced(
      tenantId,
      detached.id,
    );
    if (removedUrl) {
      await this.removeReplacedFiles([removedUrl]);
    }
  }

  async deleteProductMediaSlot(
    productId: string,
    slot: ProductMediaSlot,
  ): Promise<void> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existingProductId = await this.mediaRepository.findProductId(
      tenantId,
      productId,
    );
    if (!existingProductId) {
      throw new LinkedProductNotFoundException();
    }

    const cleared = await this.mediaRepository.clearProductMediaSlot({
      tenantId,
      productId,
      role: slot === 'presentation' ? 'PRIMARY' : 'AR_MODEL',
    });
    await this.removeReplacedFiles(cleared.removedUrls);
  }

  async uploadComboImage(
    comboId: string,
    file: Express.Multer.File | undefined,
    uploadedByUserId: string,
  ): Promise<ComboImageUploadResult> {
    if (!file?.buffer || file.size <= 0) {
      throw new MissingMediaFileException();
    }

    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existingComboId = await this.mediaRepository.findComboId(
      tenantId,
      comboId,
    );
    if (!existingComboId) {
      throw new LinkedComboNotFoundException();
    }

    const classified = classifyUploadFile(file.originalname);
    if (classified.kind !== 'image') {
      throw new MediaSlotTypeMismatchException('presentation');
    }

    assertFileSize(
      'image',
      file.size,
      this.byteLimit('MEDIA_IMAGE_MAX_BYTES', 10 * 1024 * 1024),
      this.byteLimit('MEDIA_MODEL_MAX_BYTES', 50 * 1024 * 1024),
    );

    await this.assertStorageQuota(tenantId, file.size);

    const stored = await this.storage.uploadTenantProductFile({
      tenantId,
      productId: comboId,
      originalName: file.originalname,
      body: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
    });

    try {
      const asset = await this.mediaRepository.createImageAsset({
        tenantId,
        uploadedByUserId,
        originalUrl: stored.publicUrl,
        fileSizeBytes: file.size,
      });
      const detached = await this.mediaRepository.attachComboImage({
        tenantId,
        comboId,
        mediaAssetId: asset.id,
      });
      if (detached.previousAssetId) {
        const removedUrl = await this.mediaRepository.deleteIfUnreferenced(
          tenantId,
          detached.previousAssetId,
        );
        if (removedUrl) {
          await this.removeReplacedFiles([removedUrl]);
        }
      }
      return {
        id: asset.id,
        publicUrl: asset.originalUrl,
        fileName: file.originalname,
      };
    } catch (error: unknown) {
      await this.storage.remove(stored.path);
      throw error;
    }
  }

  async deleteComboImage(comboId: string): Promise<void> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existingComboId = await this.mediaRepository.findComboId(
      tenantId,
      comboId,
    );
    if (!existingComboId) {
      throw new LinkedComboNotFoundException();
    }

    const detached = await this.mediaRepository.detachComboImage({
      tenantId,
      comboId,
    });
    if (!detached.previousAssetId) {
      return;
    }
    const removedUrl = await this.mediaRepository.deleteIfUnreferenced(
      tenantId,
      detached.previousAssetId,
    );
    if (removedUrl) {
      await this.removeReplacedFiles([removedUrl]);
    }
  }

  private async removeReplacedFiles(urls: readonly string[]): Promise<void> {
    for (const url of urls) {
      const path = this.storage.pathFromPublicUrl(url);
      if (path) {
        await this.storage.remove(path);
      }
    }
  }

  private async assertStorageQuota(
    tenantId: string,
    incomingBytes: number,
  ): Promise<void> {
    const limits = await this.tenantService.findCatalogLimits(tenantId);
    if (!limits) {
      throw new LinkedProductNotFoundException();
    }
    const usedBytes = await this.mediaRepository.sumFileSizeBytes(tenantId);
    const maxBytes = limits.maxStorageMb * 1024 * 1024;
    if (usedBytes + incomingBytes > maxBytes) {
      throw new StorageQuotaExceededException();
    }
  }

  private byteLimit(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    if (!raw) {
      return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}

function toResolvedMediaAsset(asset: MediaAssetRow): ResolvedMediaAsset {
  const imageUrl =
    asset.fileType === 'IMAGE' && asset.originalUrl ? asset.originalUrl : null;

  return {
    thumbnailUrl: pickLatestVariantUrl(asset.variants, 'THUMBNAIL') ?? imageUrl,
    detailUrl: pickLatestVariantUrl(asset.variants, 'DETAIL') ?? imageUrl,
    arCutoutUrl: pickLatestVariantUrl(asset.variants, 'AR_CUTOUT'),
    model3dUrl:
      asset.fileType === 'MODEL_3D' && asset.originalUrl
        ? asset.originalUrl
        : null,
  };
}

function pickLatestVariantUrl(
  variants: readonly { readonly purpose: MediaVariantPurpose; readonly url: string; readonly createdAt: Date }[],
  purpose: MediaVariantPurpose,
): string | null {
  let latest: { readonly url: string; readonly createdAt: Date } | null = null;

  for (const variant of variants) {
    if (variant.purpose !== purpose) {
      continue;
    }
    if (!latest || variant.createdAt.getTime() > latest.createdAt.getTime()) {
      latest = variant;
    }
  }

  return latest?.url ?? null;
}
