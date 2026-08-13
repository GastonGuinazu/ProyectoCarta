import { Inject, Injectable } from '@nestjs/common';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type { PromoRow } from './promo-row.type';

/**
 * Única capa autorizada a hablar con Prisma para el modelo `Promo`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta `TENANT_PRISMA_CLIENT`
 * (Capa 2 de aislamiento), y pasa `tenantId` explícito en el `where`
 * (Capa 1).
 */
@Injectable()
export class PromoRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * "Vigente" se evalúa en tiempo real contra `now` (`startAt <= now <= endAt`),
   * NUNCA confiando en el campo `status` como única fuente de verdad
   * (features-spec.md §3.3: "la determinación de si una Promo está
   * actualmente activa debe evaluarse en el backend, en el momento de servir
   * el menú"). `status` solo se usa para excluir una Promo `CANCELLED`: es la
   * única transición que es una decisión administrativa explícita, no
   * derivable de la ventana de fechas por sí sola.
   *
   * Sincronizar el campo `status` (programada -> activa -> expirada) hacia la
   * base de datos, si se necesita para el Panel Admin, es responsabilidad de
   * un proceso periódico aparte — no de esta lectura.
   */
  async findActiveForBranch(
    tenantId: string,
    branchId: string,
    now: Date,
  ): Promise<readonly PromoRow[]> {
    const promos = await this.prisma.promo.findMany({
      where: {
        tenantId,
        status: { not: 'CANCELLED' },
        startAt: { lte: now },
        endAt: { gte: now },
        OR: [
          { availableInAllBranches: true },
          { branches: { some: { branchId } } },
        ],
      },
      include: {
        productTargets: { select: { productId: true } },
        categoryTargets: { select: { categoryId: true } },
        comboTargets: { select: { comboId: true } },
      },
    });

    return promos.map((promo) => ({
      id: promo.id,
      name: promo.name as LocalizedText,
      discountType: promo.discountType,
      discountPercentageBp: promo.discountPercentageBp,
      discountAmountCents: promo.discountAmountCents,
      fixedPriceCents: promo.fixedPriceCents,
      priority: promo.priority,
      createdAt: promo.createdAt,
      productIds: promo.productTargets.map((target) => target.productId),
      categoryIds: promo.categoryTargets.map((target) => target.categoryId),
      comboIds: promo.comboTargets.map((target) => target.comboId),
    }));
  }
}
