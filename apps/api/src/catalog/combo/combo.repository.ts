import { Inject, Injectable } from '@nestjs/common';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type { ComboRow } from './combo-row.type';

/**
 * Única capa autorizada a hablar con Prisma para el modelo `Combo`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta `TENANT_PRISMA_CLIENT`
 * (Capa 2 de aislamiento), y pasa `tenantId` explícito en el `where`
 * (Capa 1, defensa en profundidad).
 */
@Injectable()
export class ComboRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * "Disponibles en la sucursal" combina dos condiciones independientes,
   * ambas seguras de aplicar a nivel de consulta (a diferencia de
   * `CategoryRepository`, un Combo no tiene hijos cuya visibilidad dependa de
   * él, así que no hay riesgo de "huérfanos" al filtrar acá):
   *
   * 1. Disponibilidad por sucursal: igual patrón que `Product`
   *    (`availableInAllBranches` OR existe una fila en `branchAvailabilities`
   *    para este `branchId`).
   * 2. Vigencia temporal: `startAt`/`endAt` son opcionales en el schema
   *    ("puede tener fecha de inicio/fin, similar a una Promo"). Un combo sin
   *    fecha en alguno de los dos extremos se considera abierto en ese
   *    extremo; si tiene fecha, exige que `now` esté dentro del rango.
   *
   * NO se filtra por `availability` (AVAILABLE/OUT_OF_STOCK/DISCONTINUED):
   * igual que en `ProductRepository`, ese estado se expone tal cual para que
   * el frontend decida cómo renderizarlo (ej. tachado), en vez de ocultarlo
   * silenciosamente en el backend.
   */
  async findAvailableForBranch(
    tenantId: string,
    branchId: string,
  ): Promise<readonly ComboRow[]> {
    const now = new Date();

    const combos = await this.prisma.combo.findMany({
      where: {
        tenantId,
        AND: [
          {
            OR: [
              { availableInAllBranches: true },
              { branchAvailabilities: { some: { branchId } } },
            ],
          },
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, slug: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return combos.map((combo) => ({
      id: combo.id,
      slug: combo.slug,
      name: combo.name as LocalizedText,
      description: combo.description as LocalizedText | null,
      priceCents: combo.priceCents,
      currency: combo.currency,
      imageMediaAssetId: combo.imageMediaAssetId,
      availability: combo.availability,
      items: combo.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          slug: item.product.slug,
          name: item.product.name as LocalizedText,
        },
      })),
    }));
  }
}
