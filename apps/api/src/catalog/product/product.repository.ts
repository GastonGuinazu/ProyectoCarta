import { Inject, Injectable } from '@nestjs/common';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type { ProductRow } from './product-row.type';

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
        // `role: 'PRIMARY'` no está garantizado único a nivel de esquema
        // (`@@unique` de `ProductMedia` es sobre `[productId, mediaAssetId]`,
        // no sobre `[productId, role]`); se ordena por `order` y se toma el
        // primero para tener un criterio determinístico ante datos
        // inconsistentes, sin que la consulta explote.
        media: {
          where: { role: 'PRIMARY' },
          select: { mediaAssetId: true },
          orderBy: { order: 'asc' },
          take: 1,
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

    return products.map((product) => ({
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
      primaryMediaAssetId: product.media[0]?.mediaAssetId ?? null,
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
    }));
  }
}
