import { Inject, Injectable } from '@nestjs/common';
import {
  MediaFileType,
  MediaPipelineStatus,
  MediaRole,
} from '@prisma/client';
import {
  TENANT_PRISMA_CLIENT,
  type TenantScopedPrismaClient,
} from '../core';
import type { MediaAssetRow } from './media-asset-row.type';

/**
 * Única capa autorizada a hablar con Prisma para `MediaAsset`/`ProcessedVariant`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta `TENANT_PRISMA_CLIENT`
 * (Capa 2 de aislamiento), y pasa `tenantId` explícito en el `where` (Capa 1).
 */
@Injectable()
export class MediaRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * Resuelve TODOS los `assetIds` pedidos en una única consulta (`id: { in: [...] }`)
   * con sus `ProcessedVariant` incluidas vía `include` — es la pieza clave de la
   * estrategia anti-N+1 explicada al usuario: sin importar cuántas
   * categorías/productos/combos referencien imágenes, esta es la ÚNICA
   * consulta a la base de datos que `MediaModule` ejecuta por request de menú
   * público (ver `MediaService.resolveMediaAssets`, que es quien deduplica y
   * arma el batch antes de llamar acá).
   */
  async findByIds(
    tenantId: string,
    assetIds: readonly string[],
  ): Promise<readonly MediaAssetRow[]> {
    if (assetIds.length === 0) {
      return [];
    }

    const assets = await this.prisma.mediaAsset.findMany({
      where: { tenantId, id: { in: assetIds as string[] } },
      include: {
        processedVariants: {
          select: { purpose: true, url: true, createdAt: true },
        },
      },
    });

    return assets.map((asset) => ({
      id: asset.id,
      fileType: asset.fileType,
      originalUrl: asset.originalUrl,
      variants: asset.processedVariants,
    }));
  }

  /**
   * Comprueba que el Product exista en este tenant sin importar CatalogModule
   * (docs/backend-architecture.md §2.2 — Media no importa Catalog).
   */
  async findProductId(
    tenantId: string,
    productId: string,
  ): Promise<string | null> {
    const product = await this.prisma.product.findFirst({
      where: { tenantId, id: productId },
      select: { id: true },
    });
    return product?.id ?? null;
  }

  async findComboId(
    tenantId: string,
    comboId: string,
  ): Promise<string | null> {
    const combo = await this.prisma.combo.findFirst({
      where: { tenantId, id: comboId },
      select: { id: true },
    });
    return combo?.id ?? null;
  }

  async attachComboImage(input: {
    readonly tenantId: string;
    readonly comboId: string;
    readonly mediaAssetId: string;
  }): Promise<{ readonly previousAssetId: string | null }> {
    const existing = await this.prisma.combo.findFirst({
      where: { tenantId: input.tenantId, id: input.comboId },
      select: { imageMediaAssetId: true },
    });
    await this.prisma.combo.update({
      where: { id: input.comboId },
      data: { imageMediaAssetId: input.mediaAssetId },
    });
    return { previousAssetId: existing?.imageMediaAssetId ?? null };
  }

  async detachComboImage(input: {
    readonly tenantId: string;
    readonly comboId: string;
  }): Promise<{ readonly previousAssetId: string | null }> {
    const existing = await this.prisma.combo.findFirst({
      where: { tenantId: input.tenantId, id: input.comboId },
      select: { imageMediaAssetId: true },
    });
    if (!existing?.imageMediaAssetId) {
      return { previousAssetId: null };
    }
    await this.prisma.combo.update({
      where: { id: input.comboId },
      data: { imageMediaAssetId: null },
    });
    return { previousAssetId: existing.imageMediaAssetId };
  }

  async sumFileSizeBytes(tenantId: string): Promise<number> {
    const result = await this.prisma.mediaAsset.aggregate({
      where: { tenantId },
      _sum: { fileSizeBytes: true },
    });
    return result._sum.fileSizeBytes ?? 0;
  }

  /**
   * Crea un `MediaAsset` y lo engancha al producto en el `role` pedido
   * (`PRIMARY` o `AR_MODEL`). Si ya había un asset en ese rol, lo desvincula
   * y, si nadie más lo referencia, lo borra. Así imagen y modelo conviven
   * sin pisarse.
   */
  async upsertProductMediaSlot(input: {
    readonly tenantId: string;
    readonly productId: string;
    readonly uploadedByUserId: string;
    readonly fileType: MediaFileType;
    readonly originalUrl: string;
    readonly fileSizeBytes: number;
    readonly role: MediaRole;
  }): Promise<{
    readonly id: string;
    readonly originalUrl: string;
    readonly fileType: MediaFileType;
    readonly role: MediaRole;
    readonly replacedUrls: readonly string[];
  }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productMedia.findMany({
        where: {
          tenantId: input.tenantId,
          productId: input.productId,
          role: input.role,
        },
        select: {
          mediaAssetId: true,
          mediaAsset: { select: { originalUrl: true } },
        },
      });

      const created = await tx.mediaAsset.create({
        data: {
          tenantId: input.tenantId,
          uploadedByUserId: input.uploadedByUserId,
          fileType: input.fileType,
          originalUrl: input.originalUrl,
          fileSizeBytes: input.fileSizeBytes,
          pipelineStatus: MediaPipelineStatus.READY,
        },
        select: { id: true, originalUrl: true, fileType: true },
      });

      await tx.productMedia.create({
        data: {
          tenantId: input.tenantId,
          productId: input.productId,
          mediaAssetId: created.id,
          role: input.role,
          order: 0,
        },
      });

      const replacedUrls: string[] = [];
      for (const row of existing) {
        await tx.productMedia.deleteMany({
          where: {
            tenantId: input.tenantId,
            productId: input.productId,
            mediaAssetId: row.mediaAssetId,
          },
        });
        const stillLinked = await tx.productMedia.count({
          where: { tenantId: input.tenantId, mediaAssetId: row.mediaAssetId },
        });
        if (stillLinked === 0) {
          replacedUrls.push(row.mediaAsset.originalUrl);
          await tx.mediaAsset.deleteMany({
            where: { id: row.mediaAssetId, tenantId: input.tenantId },
          });
        }
      }

      return { ...created, role: input.role, replacedUrls };
    });
  }

  /**
   * Desvincula el slot (`PRIMARY` o `AR_MODEL`) sin crear un asset nuevo.
   * Si el `MediaAsset` no queda referenciado por otro producto, se borra.
   */
  async clearProductMediaSlot(input: {
    readonly tenantId: string;
    readonly productId: string;
    readonly role: MediaRole;
  }): Promise<{ readonly removedUrls: readonly string[] }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productMedia.findMany({
        where: {
          tenantId: input.tenantId,
          productId: input.productId,
          role: input.role,
        },
        select: {
          mediaAssetId: true,
          mediaAsset: { select: { originalUrl: true } },
        },
      });

      const removedUrls: string[] = [];
      for (const row of existing) {
        await tx.productMedia.deleteMany({
          where: {
            tenantId: input.tenantId,
            productId: input.productId,
            mediaAssetId: row.mediaAssetId,
          },
        });
        const stillLinked = await tx.productMedia.count({
          where: { tenantId: input.tenantId, mediaAssetId: row.mediaAssetId },
        });
        if (stillLinked === 0) {
          removedUrls.push(row.mediaAsset.originalUrl);
          await tx.mediaAsset.deleteMany({
            where: { id: row.mediaAssetId, tenantId: input.tenantId },
          });
        }
      }

      return { removedUrls };
    });
  }

  async createImageAsset(input: {
    readonly tenantId: string;
    readonly uploadedByUserId: string;
    readonly originalUrl: string;
    readonly fileSizeBytes: number;
  }): Promise<{ readonly id: string; readonly originalUrl: string }> {
    return this.prisma.mediaAsset.create({
      data: {
        tenantId: input.tenantId,
        uploadedByUserId: input.uploadedByUserId,
        fileType: MediaFileType.IMAGE,
        originalUrl: input.originalUrl,
        fileSizeBytes: input.fileSizeBytes,
        pipelineStatus: MediaPipelineStatus.READY,
      },
      select: { id: true, originalUrl: true },
    });
  }

  /**
   * Borra el asset si nadie más lo referencia (producto, categoría, combo,
   * logo de tenant o banner de sucursal).
   */
  async deleteIfUnreferenced(
    tenantId: string,
    mediaAssetId: string,
  ): Promise<string | null> {
    const [productLinks, categoryLinks, comboLinks, asLogo, asBanner] =
      await Promise.all([
        this.prisma.productMedia.count({
          where: { tenantId, mediaAssetId },
        }),
        this.prisma.category.count({
          where: { tenantId, imageMediaAssetId: mediaAssetId },
        }),
        this.prisma.combo.count({
          where: { tenantId, imageMediaAssetId: mediaAssetId },
        }),
        this.prisma.tenant.count({
          where: { id: tenantId, logoMediaAssetId: mediaAssetId },
        }),
        this.prisma.branch.count({
          where: { tenantId, bannerMediaAssetId: mediaAssetId },
        }),
      ]);

    if (
      productLinks + categoryLinks + comboLinks + asLogo + asBanner >
      0
    ) {
      return null;
    }

    const existing = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaAssetId, tenantId },
      select: { originalUrl: true },
    });
    if (!existing) {
      return null;
    }
    await this.prisma.mediaAsset.deleteMany({
      where: { id: mediaAssetId, tenantId },
    });
    return existing.originalUrl;
  }
}
