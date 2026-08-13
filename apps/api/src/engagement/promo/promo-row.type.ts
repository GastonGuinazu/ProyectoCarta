import type { PromoDiscountType } from '@prisma/client';
import type { LocalizedText } from '../../core';

/**
 * Fila cruda de `Promo` (ya vigente por fecha, ver `promo.repository.ts`)
 * mapeada a un DTO de dominio. `productIds`/`categoryIds`/`comboIds` son las
 * referencias planas a sus targets (`PromoProductTarget`/`PromoCategoryTarget`/
 * `PromoComboTarget`) — la resolución de a qué entidad concreta aplica cada
 * una vive en `EngagementService`, no acá.
 */
export interface PromoRow {
  readonly id: string;
  readonly name: LocalizedText;
  readonly discountType: PromoDiscountType;
  readonly discountPercentageBp: number | null;
  readonly discountAmountCents: number | null;
  readonly fixedPriceCents: number | null;
  readonly priority: number;
  readonly createdAt: Date;
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly comboIds: readonly string[];
}
