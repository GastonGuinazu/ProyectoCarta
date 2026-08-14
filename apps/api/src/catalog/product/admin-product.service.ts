import { Injectable } from '@nestjs/common';
import { AvailabilityStatus, Prisma } from '@prisma/client';
import { TenantContextService, type LocalizedText } from '../../core';
import { MediaService } from '../../media/media.service';
import { BranchService } from '../../tenant/branch/branch.service';
import { TenantService } from '../../tenant/tenant.service';
import { CategoryRepository } from '../category/category.repository';
import { PlatformCatalogRepository } from '../platform-catalog.repository';
import {
  CategoryNotFoundException,
  DuplicateSkuException,
  MediaAssetNotFoundException,
  PlanLimitExceededException,
  ProductInUseException,
  ProductNotFoundException,
  ProductValidationException,
} from './admin-product.exceptions';
import type {
  AdminProductPatchInput,
  AdminProductRecord,
  AdminProductWriteInput,
  AdminVariantGroupWrite,
} from './admin-product.types';
import {
  BranchAvailabilityMode,
  type CreateProductDto,
} from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import { ProductRepository } from './product.repository';

@Injectable()
export class AdminProductService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly tenantService: TenantService,
    private readonly branchService: BranchService,
    private readonly categoryRepository: CategoryRepository,
    private readonly productRepository: ProductRepository,
    private readonly platformCatalogRepository: PlatformCatalogRepository,
    private readonly mediaService: MediaService,
  ) {}

  async list(): Promise<{ readonly items: readonly AdminProductListItem[] }> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const rows = await this.productRepository.findAdminList(tenantId);
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        basePrice: row.basePriceCents,
        currency: row.currency,
        availability: row.availability,
        primaryUrl: row.primaryUrl,
      })),
    };
  }

  async getById(productId: string): Promise<AdminProductResponse> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.productRepository.findAdminById(
      tenantId,
      productId,
    );
    if (!existing) {
      throw new ProductNotFoundException();
    }
    return toResponse(existing);
  }

  async create(dto: CreateProductDto): Promise<AdminProductResponse> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const limits = await this.requireLimits(tenantId);

    const count = await this.productRepository.countByTenant(tenantId);
    if (count >= limits.maxProducts) {
      throw new PlanLimitExceededException();
    }

    this.assertDefaultLanguage(dto.name, limits.defaultLanguage, 'name');
    if (dto.description) {
      this.assertDefaultLanguage(
        dto.description,
        limits.defaultLanguage,
        'description',
      );
    }

    await this.assertCategory(tenantId, dto.categoryId);
    if (dto.sku) {
      await this.assertSkuAvailable(tenantId, dto.sku);
    }
    await this.assertTags(dto.allergenIds ?? [], dto.dietaryTagIds ?? []);
    this.assertServingHours(
      dto.servedStartMinuteOfDay ?? null,
      dto.servedEndMinuteOfDay ?? null,
    );
    const branchIds = await this.resolveBranchIds(tenantId, dto);
    await this.assertMedia(dto);

    const slug = await this.allocateSlug(
      tenantId,
      dto.name[limits.defaultLanguage] ?? Object.values(dto.name)[0],
    );

    const created = await this.productRepository.createAdmin(
      tenantId,
      this.toWriteInput(dto, slug, branchIds),
    );
    return toResponse(created, dto.media?.ar?.enabled ?? false);
  }

  async update(
    productId: string,
    dto: UpdateProductDto,
  ): Promise<AdminProductResponse> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.productRepository.findAdminById(
      tenantId,
      productId,
    );
    if (!existing) {
      throw new ProductNotFoundException();
    }

    const limits = await this.requireLimits(tenantId);
    if (dto.name) {
      this.assertDefaultLanguage(dto.name, limits.defaultLanguage, 'name');
    }
    if (dto.description) {
      this.assertDefaultLanguage(
        dto.description,
        limits.defaultLanguage,
        'description',
      );
    }
    if (dto.categoryId) {
      await this.assertCategory(tenantId, dto.categoryId);
    }
    if (dto.sku && dto.sku !== existing.sku) {
      await this.assertSkuAvailable(tenantId, dto.sku, productId);
    }
    if (dto.allergenIds || dto.dietaryTagIds) {
      await this.assertTags(dto.allergenIds ?? [], dto.dietaryTagIds ?? []);
    }
    if (
      dto.servedStartMinuteOfDay !== undefined ||
      dto.servedEndMinuteOfDay !== undefined
    ) {
      this.assertServingHours(
        dto.servedStartMinuteOfDay !== undefined
          ? dto.servedStartMinuteOfDay
          : existing.servedStartMinuteOfDay,
        dto.servedEndMinuteOfDay !== undefined
          ? dto.servedEndMinuteOfDay
          : existing.servedEndMinuteOfDay,
      );
    }
    const branchIds = dto.branchAvailability
      ? await this.resolveBranchIds(tenantId, dto)
      : undefined;
    if (dto.media) {
      await this.assertMedia(dto);
    }

    const updated = await this.productRepository.updateAdmin(
      tenantId,
      productId,
      this.toPatchInput(dto, branchIds, {
        servedStartMinuteOfDay: existing.servedStartMinuteOfDay,
        servedEndMinuteOfDay: existing.servedEndMinuteOfDay,
      }),
    );
    return toResponse(updated, dto.media?.ar?.enabled ?? false);
  }

  async remove(productId: string): Promise<void> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.productRepository.findAdminById(
      tenantId,
      productId,
    );
    if (!existing) {
      throw new ProductNotFoundException();
    }

    try {
      await this.productRepository.deleteAdmin(tenantId, productId);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new ProductInUseException();
      }
      throw error;
    }
  }

  private async requireLimits(tenantId: string) {
    const limits = await this.tenantService.findCatalogLimits(tenantId);
    if (!limits) {
      throw new ProductValidationException(
        'tenantId',
        'No se encontró el restaurante de la sesión.',
      );
    }
    return limits;
  }

  private assertDefaultLanguage(
    text: LocalizedText,
    defaultLanguage: string,
    field: string,
  ): void {
    const value = text[defaultLanguage];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ProductValidationException(
        `${field}.${defaultLanguage}`,
        'El nombre en el idioma por defecto del tenant es obligatorio.',
      );
    }
  }

  private async assertCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<void> {
    const found = await this.categoryRepository.findIdByTenant(
      tenantId,
      categoryId,
    );
    if (!found) {
      throw new CategoryNotFoundException();
    }
  }

  private async assertSkuAvailable(
    tenantId: string,
    sku: string,
    excludingProductId?: string,
  ): Promise<void> {
    const existingId = await this.productRepository.findIdBySku(tenantId, sku);
    if (existingId && existingId !== excludingProductId) {
      throw new DuplicateSkuException();
    }
  }

  private async assertTags(
    allergenIds: readonly string[],
    dietaryTagIds: readonly string[],
  ): Promise<void> {
    if (allergenIds.length > 0) {
      const count =
        await this.platformCatalogRepository.countAllergensByIds(allergenIds);
      if (count !== new Set(allergenIds).size) {
        throw new ProductValidationException(
          'allergenIds',
          'Uno o más alérgenos no existen en el catálogo de plataforma.',
        );
      }
    }
    if (dietaryTagIds.length > 0) {
      const count =
        await this.platformCatalogRepository.countDietaryTagsByIds(
          dietaryTagIds,
        );
      if (count !== new Set(dietaryTagIds).size) {
        throw new ProductValidationException(
          'dietaryTagIds',
          'Uno o más tags dietéticos no existen en el catálogo de plataforma.',
        );
      }
    }
  }

  private assertServingHours(
    startMinuteOfDay: number | null,
    endMinuteOfDay: number | null,
  ): void {
    const hasStart = startMinuteOfDay !== null;
    const hasEnd = endMinuteOfDay !== null;
    if (hasStart !== hasEnd) {
      throw new ProductValidationException(
        'servedEndMinuteOfDay',
        'Indicá hora de inicio y de fin, o dejá ambas vacías.',
      );
    }
    if (
      hasStart &&
      hasEnd &&
      startMinuteOfDay === endMinuteOfDay
    ) {
      throw new ProductValidationException(
        'servedEndMinuteOfDay',
        'La hora de fin debe ser distinta a la de inicio.',
      );
    }
  }

  private async resolveBranchIds(
    tenantId: string,
    dto: Pick<CreateProductDto, 'branchAvailability'>,
  ): Promise<readonly string[]> {
    const availability = dto.branchAvailability;
    if (
      !availability ||
      availability.mode === BranchAvailabilityMode.ALL_BRANCHES
    ) {
      return [];
    }

    const uniqueIds = [...new Set(availability.branchIds)];
    const existing = await this.branchService.findExistingIds(
      tenantId,
      uniqueIds,
    );
    if (existing.length !== uniqueIds.length) {
      throw new ProductValidationException(
        'branchAvailability.branchIds',
        'Una o más sucursales no pertenecen a este restaurante.',
      );
    }
    return uniqueIds;
  }

  private async assertMedia(
    dto: Pick<CreateProductDto, 'media'>,
  ): Promise<void> {
    const media = dto.media;
    if (!media) {
      return;
    }
    const ids = [
      media.primaryMediaAssetId,
      ...(media.galleryMediaAssetIds ?? []),
      ...(media.ar?.sourceMediaAssetId ? [media.ar.sourceMediaAssetId] : []),
    ];
    const unique = [...new Set(ids)];
    const resolved = await this.mediaService.resolveMediaAssets(unique);
    if (resolved.size !== unique.length) {
      throw new MediaAssetNotFoundException();
    }
  }

  private async allocateSlug(tenantId: string, source: string): Promise<string> {
    const base = slugify(source);
    let candidate = base;
    let suffix = 2;
    while (await this.productRepository.findIdBySlug(tenantId, candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private toWriteInput(
    dto: CreateProductDto,
    slug: string,
    branchIds: readonly string[],
  ): AdminProductWriteInput {
    const allBranches =
      !dto.branchAvailability ||
      dto.branchAvailability.mode === BranchAvailabilityMode.ALL_BRANCHES;

    return {
      categoryId: dto.categoryId,
      slug,
      name: dto.name,
      description: dto.description ?? null,
      basePriceCents: dto.basePrice,
      currency: dto.currency,
      sku: dto.sku ?? null,
      order: dto.order ?? 0,
      availability: dto.availability ?? AvailabilityStatus.AVAILABLE,
      availableInAllBranches: allBranches,
      branchIds: allBranches ? [] : branchIds,
      allergenIds: dto.allergenIds ?? [],
      dietaryTagIds: dto.dietaryTagIds ?? [],
      servedStartMinuteOfDay: dto.servedStartMinuteOfDay ?? null,
      servedEndMinuteOfDay: dto.servedEndMinuteOfDay ?? null,
      primaryMediaAssetId: dto.media?.primaryMediaAssetId ?? null,
      galleryMediaAssetIds: dto.media?.galleryMediaAssetIds ?? [],
      variantGroups: toVariantWrites(dto.variantGroups),
    };
  }

  private toPatchInput(
    dto: UpdateProductDto,
    branchIds?: readonly string[],
    existingHours?: {
      readonly servedStartMinuteOfDay: number | null;
      readonly servedEndMinuteOfDay: number | null;
    },
  ): AdminProductPatchInput {
    const servingHoursTouched =
      dto.servedStartMinuteOfDay !== undefined ||
      dto.servedEndMinuteOfDay !== undefined;
    const patch: AdminProductPatchInput = {
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.basePrice !== undefined
        ? { basePriceCents: dto.basePrice }
        : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
      ...(dto.availability !== undefined
        ? { availability: dto.availability }
        : {}),
      ...(dto.allergenIds !== undefined
        ? { allergenIds: dto.allergenIds }
        : {}),
      ...(dto.dietaryTagIds !== undefined
        ? { dietaryTagIds: dto.dietaryTagIds }
        : {}),
      ...(servingHoursTouched
        ? {
            servedStartMinuteOfDay:
              dto.servedStartMinuteOfDay !== undefined
                ? dto.servedStartMinuteOfDay
                : (existingHours?.servedStartMinuteOfDay ?? null),
            servedEndMinuteOfDay:
              dto.servedEndMinuteOfDay !== undefined
                ? dto.servedEndMinuteOfDay
                : (existingHours?.servedEndMinuteOfDay ?? null),
          }
        : {}),
      ...(dto.variantGroups !== undefined
        ? { variantGroups: toVariantWrites(dto.variantGroups) }
        : {}),
    };

    const allBranches =
      dto.branchAvailability && branchIds
        ? dto.branchAvailability.mode === BranchAvailabilityMode.ALL_BRANCHES
        : undefined;

    return {
      ...patch,
      ...(allBranches !== undefined
        ? {
            availableInAllBranches: allBranches,
            branchIds: allBranches ? [] : (branchIds ?? []),
          }
        : {}),
      ...(dto.media
        ? {
            primaryMediaAssetId: dto.media.primaryMediaAssetId,
            galleryMediaAssetIds: dto.media.galleryMediaAssetIds ?? [],
          }
        : {}),
    };
  }
}

export interface AdminProductListItem {
  readonly id: string;
  readonly name: LocalizedText;
  readonly categoryId: string;
  readonly categoryName: LocalizedText;
  readonly basePrice: number;
  readonly currency: string;
  readonly availability: string;
  readonly primaryUrl: string | null;
}

export interface AdminProductResponse {
  readonly id: string;
  readonly slug: string;
  readonly categoryId: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly basePrice: number;
  readonly currency: string;
  readonly sku: string | null;
  readonly order: number;
  readonly availability: string;
  readonly allergenIds: readonly string[];
  readonly dietaryTagIds: readonly string[];
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
  readonly branchAvailability: {
    readonly mode: BranchAvailabilityMode;
    readonly branchIds: readonly string[];
  };
  readonly media: {
    readonly primaryMediaAssetId: string | null;
    readonly primaryUrl: string | null;
    readonly primaryFileType: string | null;
    readonly galleryMediaAssetIds: readonly string[];
    readonly arModel: {
      readonly mediaAssetId: string | null;
      readonly url: string | null;
    };
    readonly ar: { readonly enabled: boolean };
  };
  readonly variantGroups: readonly {
    readonly id: string;
    readonly name: LocalizedText;
    readonly selectionType: string;
    readonly required: boolean;
    readonly options: readonly {
      readonly id: string;
      readonly name: LocalizedText;
      readonly priceDelta: number;
      readonly available: boolean;
    }[];
  }[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toVariantWrites(
  groups: CreateProductDto['variantGroups'],
): AdminVariantGroupWrite[] {
  return (groups ?? []).map((group, groupIndex) => ({
    name: group.name,
    selectionType: group.selectionType,
    required: group.required,
    order: groupIndex,
    options: group.options.map((option, optionIndex) => ({
      name: option.name,
      priceDeltaCents: option.priceDelta,
      order: optionIndex,
    })),
  }));
}

function toResponse(
  record: AdminProductRecord,
  arEnabled = false,
): AdminProductResponse {
  return {
    id: record.id,
    slug: record.slug,
    categoryId: record.categoryId,
    name: record.name,
    description: record.description,
    basePrice: record.basePriceCents,
    currency: record.currency,
    sku: record.sku,
    order: record.order,
    availability: record.availability,
    allergenIds: record.allergenIds,
    dietaryTagIds: record.dietaryTagIds,
    servedStartMinuteOfDay: record.servedStartMinuteOfDay,
    servedEndMinuteOfDay: record.servedEndMinuteOfDay,
    branchAvailability: {
      mode: record.availableInAllBranches
        ? BranchAvailabilityMode.ALL_BRANCHES
        : BranchAvailabilityMode.SPECIFIC_BRANCHES,
      branchIds: record.branchIds,
    },
    media: {
      primaryMediaAssetId: record.primaryMediaAssetId,
      primaryUrl: record.primaryMediaUrl,
      primaryFileType: record.primaryMediaFileType,
      galleryMediaAssetIds: record.galleryMediaAssetIds,
      arModel: {
        mediaAssetId: record.arModelMediaAssetId,
        url: record.arModelUrl,
      },
      ar: { enabled: arEnabled || Boolean(record.arModelUrl) },
    },
    variantGroups: record.variantGroups.map((group) => ({
      id: group.id,
      name: group.name,
      selectionType: group.selectionType,
      required: group.required,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: option.priceDeltaCents,
        available: option.available,
      })),
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug.length > 0 ? slug : 'producto';
}
