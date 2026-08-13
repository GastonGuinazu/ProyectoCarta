import { Inject, Injectable } from '@nestjs/common';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type { HappyHourRow } from './happy-hour-row.type';

/**
 * Única capa autorizada a hablar con Prisma para el modelo `HappyHour`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta `TENANT_PRISMA_CLIENT`
 * (Capa 2), y pasa `tenantId` explícito en el `where` (Capa 1).
 */
@Injectable()
export class HappyHourRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * Devuelve TODOS los Happy Hours habilitados y disponibles en la sucursal,
   * sin filtrar todavía por día de semana / rango horario: ese filtro
   * requiere conocer la timezone de la Sucursal y manejar el caso de rango
   * que cruza la medianoche (features-spec.md §3.3), y se resuelve en
   * `EngagementService` para mantener este Repository libre de lógica de
   * negocio (.cursor/rules/03-backend-nestjs.mdc).
   */
  async findEnabledForBranch(
    tenantId: string,
    branchId: string,
  ): Promise<readonly HappyHourRow[]> {
    const happyHours = await this.prisma.happyHour.findMany({
      where: {
        tenantId,
        enabled: true,
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

    return happyHours.map((happyHour) => ({
      id: happyHour.id,
      name: happyHour.name as LocalizedText,
      discountType: happyHour.discountType,
      discountPercentageBp: happyHour.discountPercentageBp,
      discountAmountCents: happyHour.discountAmountCents,
      fixedPriceCents: happyHour.fixedPriceCents,
      daysOfWeek: happyHour.daysOfWeek,
      startMinuteOfDay: happyHour.startMinuteOfDay,
      endMinuteOfDay: happyHour.endMinuteOfDay,
      priority: happyHour.priority,
      createdAt: happyHour.createdAt,
      productIds: happyHour.productTargets.map((target) => target.productId),
      categoryIds: happyHour.categoryTargets.map((target) => target.categoryId),
      comboIds: happyHour.comboTargets.map((target) => target.comboId),
    }));
  }
}
