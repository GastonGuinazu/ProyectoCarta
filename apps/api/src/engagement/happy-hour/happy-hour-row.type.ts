import type { DayOfWeek, PromoDiscountType } from '@prisma/client';
import type { LocalizedText } from '../../core';

/**
 * Fila cruda de `HappyHour` (habilitado + disponible en la sucursal, ver
 * `happy-hour.repository.ts`) mapeada a un DTO de dominio. A diferencia de
 * `PromoRow`, todavía NO está evaluado si está activo AHORA MISMO
 * (día de semana + rango horario en la timezone de la Sucursal): esa
 * evaluación vive en `EngagementService`/`branch-local-time.util.ts`, porque
 * requiere la `timezone` de la Sucursal, que este Repository no consulta.
 */
export interface HappyHourRow {
  readonly id: string;
  readonly name: LocalizedText;
  readonly discountType: PromoDiscountType;
  readonly discountPercentageBp: number | null;
  readonly discountAmountCents: number | null;
  readonly fixedPriceCents: number | null;
  readonly daysOfWeek: readonly DayOfWeek[];
  readonly startMinuteOfDay: number;
  readonly endMinuteOfDay: number;
  readonly priority: number;
  readonly createdAt: Date;
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly comboIds: readonly string[];
}
