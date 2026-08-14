import type {
  DayOfWeek,
  PromoDiscountType,
  PromoStatus,
} from '@prisma/client';
import type { LocalizedText } from '../core';

export interface AdminOfferTargets {
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly comboIds: readonly string[];
  readonly availableInAllBranches: boolean;
  readonly branchIds: readonly string[];
}

export interface AdminDiscountFields {
  readonly discountType: PromoDiscountType;
  readonly discountPercentageBp: number | null;
  readonly discountAmountCents: number | null;
  readonly fixedPriceCents: number | null;
  readonly priority: number;
}

export interface AdminPromoRecord extends AdminDiscountFields, AdminOfferTargets {
  readonly id: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly status: PromoStatus;
  readonly createdAt: Date;
}

export interface AdminHappyHourRecord
  extends AdminDiscountFields, AdminOfferTargets {
  readonly id: string;
  readonly name: LocalizedText;
  readonly daysOfWeek: readonly DayOfWeek[];
  readonly startMinuteOfDay: number;
  readonly endMinuteOfDay: number;
  readonly enabled: boolean;
  readonly createdAt: Date;
}

export interface AdminPromoWriteInput extends AdminDiscountFields, AdminOfferTargets {
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly status: PromoStatus;
}

export interface AdminHappyHourWriteInput
  extends AdminDiscountFields, AdminOfferTargets {
  readonly name: LocalizedText;
  readonly daysOfWeek: readonly DayOfWeek[];
  readonly startMinuteOfDay: number;
  readonly endMinuteOfDay: number;
  readonly enabled: boolean;
}

export interface AdminProductOfferItem {
  readonly kind: 'PROMO' | 'HAPPY_HOUR';
  readonly id: string;
  readonly name: LocalizedText;
  readonly scope: 'PRODUCT' | 'CATEGORY' | 'COMBO';
  readonly discountType: PromoDiscountType;
  readonly discountPercentageBp: number | null;
  readonly discountAmountCents: number | null;
  readonly fixedPriceCents: number | null;
  readonly originalPrice: number;
  readonly finalPrice: number;
  readonly currency: string;
  readonly appliesNow: boolean;
  readonly isWinning: boolean;
  readonly startAt: string | null;
  readonly endAt: string | null;
  readonly daysOfWeek: readonly DayOfWeek[] | null;
  readonly startMinuteOfDay: number | null;
  readonly endMinuteOfDay: number | null;
  readonly enabled: boolean | null;
  readonly status: PromoStatus | null;
}
