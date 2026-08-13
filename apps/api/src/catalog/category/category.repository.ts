import { Inject, Injectable } from '@nestjs/common';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type { CategoryRow } from './category-row.type';

/**
 * Única capa autorizada a hablar con Prisma para el modelo `Category`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta `TENANT_PRISMA_CLIENT`
 * (Capa 2 de aislamiento), y además pasa `tenantId` explícito en el `where`
 * (Capa 1, obligatoria salvo la excepción documentada en `BranchRepository`).
 */
@Injectable()
export class CategoryRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * Devuelve TODAS las categorías del Tenant, no solo las de `branchId`.
   *
   * Es intencional: la herencia de visibilidad/disponibilidad
   * (features-spec.md §2.5 — "la restricción a nivel categoría es la más alta
   * en la jerarquía") solo puede evaluarse correctamente una vez armado el
   * árbol completo. Si acá filtráramos por `branchId` o `visible`, un ancestro
   * invisible en esta sucursal quedaría afuera de la lista plana y sus
   * descendientes (aunque individualmente visibles) se promoverían
   * incorrectamente a la raíz. Esa combinación con los ancestros la resuelve
   * `CatalogService` una vez armado el árbol completo (ver
   * `category-tree.builder.ts`).
   *
   * Ordenado por `order` ascendente: el builder del árbol confía en este orden
   * para preservar la posición relativa entre categorías hermanas sin volver a
   * ordenar en memoria.
   */
  async findAllForTenant(
    tenantId: string,
    branchId: string,
  ): Promise<readonly CategoryRow[]> {
    const categories = await this.prisma.category.findMany({
      where: { tenantId },
      include: {
        branchAvailabilities: {
          where: { branchId },
          select: { id: true },
        },
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    return categories.map((category) => ({
      id: category.id,
      parentId: category.parentId,
      slug: category.slug,
      name: category.name as LocalizedText,
      description: category.description as LocalizedText | null,
      order: category.order,
      visible: category.visible,
      imageMediaAssetId: category.imageMediaAssetId,
      isAvailableAtBranch:
        category.availableInAllBranches ||
        category.branchAvailabilities.length > 0,
    }));
  }
}
