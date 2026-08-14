import type { LocalizedText } from '../../../core/models/menu.models';

export type AdminDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE';
export type AdminPromoStatus = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type AdminDayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface AdminPromo {
  readonly id: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly discountType: AdminDiscountType;
  readonly discountPercentageBp: number | null;
  readonly discountAmountCents: number | null;
  readonly fixedPriceCents: number | null;
  readonly startAt: string;
  readonly endAt: string;
  readonly priority: number;
  readonly status: AdminPromoStatus;
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly comboIds: readonly string[];
}

export interface AdminHappyHour {
  readonly id: string;
  readonly name: LocalizedText;
  readonly discountType: AdminDiscountType;
  readonly discountPercentageBp: number | null;
  readonly discountAmountCents: number | null;
  readonly fixedPriceCents: number | null;
  readonly daysOfWeek: readonly AdminDayOfWeek[];
  readonly startMinuteOfDay: number;
  readonly endMinuteOfDay: number;
  readonly priority: number;
  readonly enabled: boolean;
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly comboIds: readonly string[];
}

export interface AdminProductOffer {
  readonly kind: 'PROMO' | 'HAPPY_HOUR';
  readonly id: string;
  readonly name: LocalizedText;
  readonly scope: 'PRODUCT' | 'CATEGORY' | 'COMBO';
  readonly discountType: AdminDiscountType;
  readonly originalPrice: number;
  readonly finalPrice: number;
  readonly currency: string;
  readonly appliesNow: boolean;
  readonly isWinning: boolean;
  readonly startAt: string | null;
  readonly endAt: string | null;
  readonly daysOfWeek: readonly AdminDayOfWeek[] | null;
  readonly startMinuteOfDay: number | null;
  readonly endMinuteOfDay: number | null;
  readonly enabled: boolean | null;
  readonly status: AdminPromoStatus | null;
}

export interface AdminPromoWritePayload {
  readonly name: LocalizedText;
  readonly description?: LocalizedText;
  readonly discountType: AdminDiscountType;
  readonly discountPercentageBp?: number;
  readonly discountAmountCents?: number;
  readonly fixedPriceCents?: number;
  readonly startAt: string;
  readonly endAt: string;
  readonly priority?: number;
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly comboIds: readonly string[];
}

export interface AdminHappyHourWritePayload {
  readonly name: LocalizedText;
  readonly discountType: AdminDiscountType;
  readonly discountPercentageBp?: number;
  readonly discountAmountCents?: number;
  readonly fixedPriceCents?: number;
  readonly daysOfWeek: readonly AdminDayOfWeek[];
  readonly startMinuteOfDay: number;
  readonly endMinuteOfDay: number;
  readonly enabled?: boolean;
  readonly priority?: number;
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly comboIds: readonly string[];
}
