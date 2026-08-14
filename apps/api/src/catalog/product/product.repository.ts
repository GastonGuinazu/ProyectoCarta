import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type {
  AdminProductListRow,
  AdminProductPatchInput,
  AdminProductRecord,
  AdminProductWriteInput,
} from './admin-product.types';
import type { ProductRow } from './product-row.type';
import {
  firstServingWindow,
  parseServingWindowsJson,
  type ServingWindow,
} from './serving-windows';

const ADMIN_PRODUCT_INCLUDE = {
  allergens: { select: { allergenId: true } },
  dietaryTags: { select: { dietaryTagId: true } },
  media: {
    select: {
      mediaAssetId: true,
      role: true,
      order: true,
      mediaAsset: { select: { originalUrl: true, fileType: true } },
    },
    orderBy: { order: 'asc' as const },
  },
  variantGroups: {
    orderBy: { order: 'asc' as const },
    include: {
      options: { orderBy: { order: 'asc' as const } },
    },
  },
  branchAvailabilities: { select: { branchId: true } },
} satisfies Prisma.ProductInclude;

/**
 * Única capa autorizada a hablar con Prisma para el modelo `Product`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta `TENANT_PRISMA_CLIENT`
 * (Capa 2), y pasa `tenantId` explícito en el `where` (Capa 1).
 */
@Injectable()
export class ProductRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * A diferencia de `CategoryRepository.findAllForTenant`, acá SÍ se filtra
   * por disponibilidad en `branchId` directamente en la consulta: un Producto
   * no tiene descendientes propios cuya visibilidad dependa de él, así que no
   * hay riesgo de "huérfanos" al excluirlo de la lista plana. La herencia de
   * visibilidad de su Categoría (features-spec.md §2.5) se resuelve aparte, en
   * `CatalogService`, cruzando `categoryId` contra el árbol ya podado.
   *
   * Incluye variantes (`variantGroups.options`) y referencias de alérgenos/tags
   * dietéticos (por id, sin resolver el catálogo — eso vive en
   * `catalogs.allergens`/`catalogs.dietaryTags`, pendiente de un ticket futuro).
   */
  async findAvailableForBranch(
    tenantId: string,
    branchId: string,
  ): Promise<readonly ProductRow[]> {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        OR: [
          { availableInAllBranches: true },
          { branchAvailabilities: { some: { branchId } } },
        ],
      },
      include: {
        allergens: { select: { allergenId: true } },
        dietaryTags: { select: { dietaryTagId: true } },
        media: {
          where: { role: { in: ['PRIMARY', 'AR_MODEL'] } },
          select: {
            role: true,
            mediaAssetId: true,
            mediaAsset: { select: { fileType: true } },
          },
          orderBy: { order: 'asc' },
        },
        variantGroups: {
          orderBy: { order: 'asc' },
          include: {
            options: { orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    return products.map((product) => {
      const primary = product.media.find(
        (item) =>
          item.role === 'PRIMARY' && item.mediaAsset.fileType === 'IMAGE',
      );
      const arModel = product.media.find(
        (item) =>
          item.role === 'AR_MODEL' && item.mediaAsset.fileType === 'MODEL_3D',
      );
      return {
        id: product.id,
        categoryId: product.categoryId,
        slug: product.slug,
        name: product.name as LocalizedText,
        description: product.description as LocalizedText | null,
        basePriceCents: product.basePriceCents,
        currency: product.currency,
        availability: product.availability,
        order: product.order,
        allergenIds: product.allergens.map((row) => row.allergenId),
        dietaryTagIds: product.dietaryTags.map((row) => row.dietaryTagId),
        ...servingHoursFromProduct(product),
        primaryMediaAssetId: primary?.mediaAssetId ?? null,
        arModelMediaAssetId: arModel?.mediaAssetId ?? null,
        variantGroups: product.variantGroups.map((group) => ({
          id: group.id,
          name: group.name as LocalizedText,
          selectionType: group.selectionType,
          required: group.required,
          order: group.order,
          options: group.options.map((option) => ({
            id: option.id,
            name: option.name as LocalizedText,
            priceDeltaCents: option.priceDeltaCents,
            available: option.available,
            order: option.order,
          })),
        })),
      };
    });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.product.count({ where: { tenantId } });
  }

  async findAdminList(tenantId: string): Promise<readonly AdminProductListRow[]> {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      select: {
        id: true,
        categoryId: true,
        name: true,
        basePriceCents: true,
        currency: true,
        availability: true,
        category: { select: { name: true } },
        media: {
          where: { role: 'PRIMARY', mediaAsset: { fileType: 'IMAGE' } },
          select: { mediaAsset: { select: { originalUrl: true } } },
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    return products.map((product) => ({
      id: product.id,
      categoryId: product.categoryId,
      categoryName: product.category.name as LocalizedText,
      name: product.name as LocalizedText,
      basePriceCents: product.basePriceCents,
      currency: product.currency,
      availability: product.availability,
      primaryUrl: product.media[0]?.mediaAsset.originalUrl ?? null,
    }));
  }

  async findAdminById(
    tenantId: string,
    productId: string,
  ): Promise<AdminProductRecord | null> {
    const product = await this.prisma.product.findFirst({
      where: { tenantId, id: productId },
      include: ADMIN_PRODUCT_INCLUDE,
    });
    return product ? toAdminProductRecord(product) : null;
  }

  async findIdBySlug(tenantId: string, slug: string): Promise<string | null> {
    const row = await this.prisma.product.findFirst({
      where: { tenantId, slug },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async findIdBySku(tenantId: string, sku: string): Promise<string | null> {
    const row = await this.prisma.product.findFirst({
      where: { tenantId, sku },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async findExistingIds(
    tenantId: string,
    ids: readonly string[],
  ): Promise<readonly string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.prisma.product.findMany({
      where: { tenantId, id: { in: [...ids] } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async findNamesByIds(
    tenantId: string,
    ids: readonly string[],
  ): Promise<readonly { readonly id: string; readonly name: LocalizedText }[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.prisma.product.findMany({
      where: { tenantId, id: { in: [...ids] } },
      select: { id: true, name: true },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name as LocalizedText,
    }));
  }

  async createAdmin(
    tenantId: string,
    input: AdminProductWriteInput,
  ): Promise<AdminProductRecord> {
    const product = await this.prisma.product.create({
      data: {
        tenantId,
        ...scalarData(input),
        ...relationCreates(tenantId, input),
      },
      include: ADMIN_PRODUCT_INCLUDE,
    });
    return toAdminProductRecord(product);
  }

  async updateAdmin(
    tenantId: string,
    productId: string,
    patch: AdminProductPatchInput,
  ): Promise<AdminProductRecord> {
    const product = await this.prisma.$transaction(async (tx) => {
      if (patch.allergenIds) {
        await tx.productAllergen.deleteMany({
          where: { tenantId, productId },
        });
      }
      if (patch.dietaryTagIds) {
        await tx.productDietaryTag.deleteMany({
          where: { tenantId, productId },
        });
      }
      if (patch.branchIds || patch.availableInAllBranches === true) {
        await tx.productBranchAvailability.deleteMany({
          where: { tenantId, productId },
        });
      }
      if (
        patch.primaryMediaAssetId !== undefined ||
        patch.galleryMediaAssetIds
      ) {
        await tx.productMedia.deleteMany({
          where: {
            tenantId,
            productId,
            role: { in: ['PRIMARY', 'GALLERY'] },
          },
        });
      }
      if (patch.variantGroups) {
        await tx.variantGroup.deleteMany({ where: { tenantId, productId } });
      }

      return tx.product.update({
        where: { id: productId },
        data: {
          ...scalarPatch(patch),
          ...relationCreates(tenantId, patch),
        },
        include: ADMIN_PRODUCT_INCLUDE,
      });
    });

    return toAdminProductRecord(product);
  }

  async deleteAdmin(tenantId: string, productId: string): Promise<void> {
    await this.prisma.product.delete({
      where: { id: productId, tenantId },
    });
  }
}

type AdminProductPayload = Prisma.ProductGetPayload<{
  include: typeof ADMIN_PRODUCT_INCLUDE;
}>;

function scalarData(input: AdminProductWriteInput) {
  return {
    categoryId: input.categoryId,
    slug: input.slug,
    name: input.name,
    description: input.description ?? Prisma.JsonNull,
    basePriceCents: input.basePriceCents,
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    sku: input.sku,
    order: input.order,
    availability: input.availability,
    availableInAllBranches: input.availableInAllBranches,
    servedStartMinuteOfDay: input.servedStartMinuteOfDay,
    servedEndMinuteOfDay: input.servedEndMinuteOfDay,
    servedWindows:
      input.servedWindows.length > 0
        ? input.servedWindows
        : Prisma.JsonNull,
  };
}

function scalarPatch(patch: AdminProductPatchInput) {
  return {
    ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.description !== undefined
      ? { description: patch.description ?? Prisma.JsonNull }
      : {}),
    ...(patch.basePriceCents !== undefined
      ? { basePriceCents: patch.basePriceCents }
      : {}),
    ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
    ...(patch.sku !== undefined ? { sku: patch.sku } : {}),
    ...(patch.order !== undefined ? { order: patch.order } : {}),
    ...(patch.availability !== undefined
      ? { availability: patch.availability }
      : {}),
    ...(patch.availableInAllBranches !== undefined
      ? { availableInAllBranches: patch.availableInAllBranches }
      : {}),
    ...(patch.servedStartMinuteOfDay !== undefined
      ? { servedStartMinuteOfDay: patch.servedStartMinuteOfDay }
      : {}),
    ...(patch.servedEndMinuteOfDay !== undefined
      ? { servedEndMinuteOfDay: patch.servedEndMinuteOfDay }
      : {}),
    ...(patch.servedWindows !== undefined
      ? {
          servedWindows:
            patch.servedWindows.length > 0
              ? patch.servedWindows
              : Prisma.JsonNull,
        }
      : {}),
  };
}

function relationCreates(
  tenantId: string,
  input: Pick<
    AdminProductPatchInput,
    | 'allergenIds'
    | 'dietaryTagIds'
    | 'branchIds'
    | 'primaryMediaAssetId'
    | 'galleryMediaAssetIds'
    | 'variantGroups'
  >,
) {
  return {
    ...(input.allergenIds
      ? {
          allergens: {
            create: input.allergenIds.map((allergenId) => ({
              tenantId,
              allergenId,
            })),
          },
        }
      : {}),
    ...(input.dietaryTagIds
      ? {
          dietaryTags: {
            create: input.dietaryTagIds.map((dietaryTagId) => ({
              tenantId,
              dietaryTagId,
            })),
          },
        }
      : {}),
    ...(input.branchIds && input.branchIds.length > 0
      ? {
          branchAvailabilities: {
            create: input.branchIds.map((branchId) => ({
              tenantId,
              branchId,
            })),
          },
        }
      : {}),
    ...mediaCreates(tenantId, input.primaryMediaAssetId, input.galleryMediaAssetIds),
    ...(input.variantGroups
      ? {
          variantGroups: {
            create: input.variantGroups.map((group) => ({
              tenantId,
              name: group.name,
              selectionType: group.selectionType,
              required: group.required,
              order: group.order,
              options: {
                create: group.options.map((option) => ({
                  tenantId,
                  name: option.name,
                  priceDeltaCents: option.priceDeltaCents,
                  order: option.order,
                })),
              },
            })),
          },
        }
      : {}),
  };
}

function mediaCreates(
  tenantId: string,
  primaryMediaAssetId: string | null | undefined,
  galleryMediaAssetIds: readonly string[] | undefined,
) {
  if (primaryMediaAssetId === undefined && galleryMediaAssetIds === undefined) {
    return {};
  }

  const rows: {
    tenantId: string;
    mediaAssetId: string;
    role: 'PRIMARY' | 'GALLERY';
    order: number;
  }[] = [];
  const seen = new Set<string>();

  if (primaryMediaAssetId) {
    rows.push({
      tenantId,
      mediaAssetId: primaryMediaAssetId,
      role: 'PRIMARY',
      order: 0,
    });
    seen.add(primaryMediaAssetId);
  }

  for (const mediaAssetId of galleryMediaAssetIds ?? []) {
    if (seen.has(mediaAssetId)) {
      continue;
    }
    seen.add(mediaAssetId);
    rows.push({
      tenantId,
      mediaAssetId,
      role: 'GALLERY',
      order: rows.length,
    });
  }

  if (rows.length === 0) {
    return {};
  }

  return { media: { create: rows } };
}

function toAdminProductRecord(product: AdminProductPayload): AdminProductRecord {
  const primary = product.media.find(
    (item) => item.role === 'PRIMARY' && item.mediaAsset.fileType === 'IMAGE',
  );
  const arModel = product.media.find(
    (item) =>
      item.role === 'AR_MODEL' && item.mediaAsset.fileType === 'MODEL_3D',
  );
  return {
    id: product.id,
    slug: product.slug,
    categoryId: product.categoryId,
    name: product.name as LocalizedText,
    description: product.description as LocalizedText | null,
    basePriceCents: product.basePriceCents,
    currency: product.currency,
    sku: product.sku,
    order: product.order,
    availability: product.availability,
    availableInAllBranches: product.availableInAllBranches,
    allergenIds: product.allergens.map((row) => row.allergenId),
    dietaryTagIds: product.dietaryTags.map((row) => row.dietaryTagId),
    ...servingHoursFromProduct(product),
    branchIds: product.branchAvailabilities.map((row) => row.branchId),
    primaryMediaAssetId: primary?.mediaAssetId ?? null,
    primaryMediaUrl: primary?.mediaAsset.originalUrl ?? null,
    primaryMediaFileType: primary?.mediaAsset.fileType ?? null,
    arModelMediaAssetId: arModel?.mediaAssetId ?? null,
    arModelUrl: arModel?.mediaAsset.originalUrl ?? null,
    galleryMediaAssetIds: product.media
      .filter((item) => item.role === 'GALLERY')
      .map((item) => item.mediaAssetId),
    variantGroups: product.variantGroups.map((group) => ({
      id: group.id,
      name: group.name as LocalizedText,
      selectionType: group.selectionType,
      required: group.required,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name as LocalizedText,
        priceDeltaCents: option.priceDeltaCents,
        available: option.available,
      })),
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function servingHoursFromProduct(product: {
  readonly servedWindows: Prisma.JsonValue | null;
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
}): {
  readonly servedWindows: readonly ServingWindow[];
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
} {
  const parsed = parseServingWindowsJson(product.servedWindows);
  const windows =
    parsed && parsed.length > 0
      ? parsed
      : product.servedStartMinuteOfDay != null &&
          product.servedEndMinuteOfDay != null
        ? [
            {
              startMinuteOfDay: product.servedStartMinuteOfDay,
              endMinuteOfDay: product.servedEndMinuteOfDay,
            },
          ]
        : [];
  const first = firstServingWindow(windows);
  return {
    servedWindows: windows,
    servedStartMinuteOfDay: first.startMinuteOfDay,
    servedEndMinuteOfDay: first.endMinuteOfDay,
  };
}
