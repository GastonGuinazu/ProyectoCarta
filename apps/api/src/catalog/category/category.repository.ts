import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type { CategoryRow } from './category-row.type';

export interface AdminCategoryRecord {
  readonly id: string;
  readonly name: LocalizedText;
  readonly order: number;
  readonly productCount: number;
  readonly childCount: number;
}

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

  async findIdByTenant(
    tenantId: string,
    categoryId: string,
  ): Promise<string | null> {
    const category = await this.prisma.category.findFirst({
      where: { tenantId, id: categoryId },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  async findAdminSummaries(
    tenantId: string,
  ): Promise<readonly AdminCategoryRecord[]> {
    const categories = await this.prisma.category.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        order: true,
        _count: { select: { products: true, children: true } },
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    return categories.map(toAdminCategoryRecord);
  }

  async findAdminById(
    tenantId: string,
    categoryId: string,
  ): Promise<AdminCategoryRecord | null> {
    const category = await this.prisma.category.findFirst({
      where: { tenantId, id: categoryId },
      select: {
        id: true,
        name: true,
        order: true,
        _count: { select: { products: true, children: true } },
      },
    });
    return category ? toAdminCategoryRecord(category) : null;
  }

  async findIdsByTenant(tenantId: string): Promise<readonly string[]> {
    const categories = await this.prisma.category.findMany({
      where: { tenantId },
      select: { id: true },
    });
    return categories.map((category) => category.id);
  }

  async findIdBySlug(tenantId: string, slug: string): Promise<string | null> {
    const category = await this.prisma.category.findFirst({
      where: { tenantId, slug },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  async findExistingIds(
    tenantId: string,
    ids: readonly string[],
  ): Promise<readonly string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.prisma.category.findMany({
      where: { tenantId, id: { in: [...ids] } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async findMaxOrder(tenantId: string): Promise<number> {
    const aggregate = await this.prisma.category.aggregate({
      where: { tenantId },
      _max: { order: true },
    });
    return aggregate._max.order ?? -1;
  }

  async createAdmin(
    tenantId: string,
    input: {
      readonly slug: string;
      readonly name: LocalizedText;
      readonly order: number;
    },
  ): Promise<AdminCategoryRecord> {
    const category = await this.prisma.category.create({
      data: {
        tenantId,
        slug: input.slug,
        name: input.name,
        order: input.order,
      },
      select: {
        id: true,
        name: true,
        order: true,
        _count: { select: { products: true, children: true } },
      },
    });
    return toAdminCategoryRecord(category);
  }

  async updateAdmin(
    tenantId: string,
    categoryId: string,
    name: LocalizedText,
  ): Promise<AdminCategoryRecord> {
    const category = await this.prisma.category.update({
      where: { id: categoryId, tenantId },
      data: { name },
      select: {
        id: true,
        name: true,
        order: true,
        _count: { select: { products: true, children: true } },
      },
    });
    return toAdminCategoryRecord(category);
  }

  async deleteAdmin(tenantId: string, categoryId: string): Promise<void> {
    await this.prisma.category.delete({
      where: { id: categoryId, tenantId },
    });
  }

  /**
   * Reescribe `order` (posición visual) de las categorías indicadas en una sola
   * transacción. El índice en `categoryIds` es el nuevo `order` (0-based).
   * Cada update filtra por `tenantId` además del `id`.
   */
  async reorderAdmin(
    tenantId: string,
    categoryIds: readonly string[],
  ): Promise<void> {
    await this.prisma.$transaction(
      categoryIds.map((id, index) =>
        this.prisma.category.update({
          where: { id, tenantId },
          data: { order: index },
        }),
      ),
    );
  }
}

type AdminCategoryPayload = {
  readonly id: string;
  readonly name: Prisma.JsonValue;
  readonly order: number;
  readonly _count: { readonly products: number; readonly children: number };
};

function toAdminCategoryRecord(
  category: AdminCategoryPayload,
): AdminCategoryRecord {
  return {
    id: category.id,
    name: category.name as LocalizedText,
    order: category.order,
    productCount: category._count.products,
    childCount: category._count.children,
  };
}
