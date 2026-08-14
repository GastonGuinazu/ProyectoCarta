import { PromoDiscountType, PromoStatus } from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import {
  OfferTargetNotFoundException,
  OfferValidationException,
} from './admin-engagement.exceptions';
import type { AdminDiscountFields, AdminOfferTargets } from './admin-engagement.types';

export function derivePromoStatus(startAt: Date, endAt: Date, now = new Date()): PromoStatus {
  if (now < startAt) {
    return PromoStatus.SCHEDULED;
  }
  if (now > endAt) {
    return PromoStatus.EXPIRED;
  }
  return PromoStatus.ACTIVE;
}

export function parseDiscount(
  dto: {
    readonly discountType: PromoDiscountType;
    readonly discountPercentageBp?: number;
    readonly discountAmountCents?: number;
    readonly fixedPriceCents?: number;
    readonly priority?: number;
  },
): AdminDiscountFields {
  switch (dto.discountType) {
    case PromoDiscountType.PERCENTAGE:
      if (dto.discountPercentageBp === undefined) {
        throw new OfferValidationException(
          'discountPercentageBp',
          'Indicá el porcentaje (en basis points, 2000 = 20%).',
        );
      }
      return {
        discountType: dto.discountType,
        discountPercentageBp: dto.discountPercentageBp,
        discountAmountCents: null,
        fixedPriceCents: null,
        priority: dto.priority ?? 0,
      };
    case PromoDiscountType.FIXED_AMOUNT:
      if (dto.discountAmountCents === undefined) {
        throw new OfferValidationException(
          'discountAmountCents',
          'Indicá el monto a descontar, en centavos.',
        );
      }
      return {
        discountType: dto.discountType,
        discountPercentageBp: null,
        discountAmountCents: dto.discountAmountCents,
        fixedPriceCents: null,
        priority: dto.priority ?? 0,
      };
    case PromoDiscountType.FIXED_PRICE:
      if (dto.fixedPriceCents === undefined) {
        throw new OfferValidationException(
          'fixedPriceCents',
          'Indicá el precio promocional, en centavos.',
        );
      }
      return {
        discountType: dto.discountType,
        discountPercentageBp: null,
        discountAmountCents: null,
        fixedPriceCents: dto.fixedPriceCents,
        priority: dto.priority ?? 0,
      };
  }
}

export async function resolveOfferTargets(
  catalogService: CatalogService,
  dto: {
    readonly productIds?: string[];
    readonly categoryIds?: string[];
    readonly comboIds?: string[];
  },
): Promise<AdminOfferTargets> {
  const productIds = unique(dto.productIds ?? []);
  const categoryIds = unique(dto.categoryIds ?? []);
  const comboIds = unique(dto.comboIds ?? []);
  if (productIds.length + categoryIds.length + comboIds.length === 0) {
    throw new OfferValidationException(
      'productIds',
      'Elegí al menos un plato, una categoría o un combo.',
    );
  }

  const [existingProducts, existingCategories, existingCombos] = await Promise.all([
    catalogService.findExistingProductIds(productIds),
    catalogService.findExistingCategoryIds(categoryIds),
    catalogService.findExistingComboIds(comboIds),
  ]);
  if (
    existingProducts.length !== productIds.length ||
    existingCategories.length !== categoryIds.length ||
    existingCombos.length !== comboIds.length
  ) {
    throw new OfferTargetNotFoundException();
  }

  return {
    productIds,
    categoryIds,
    comboIds,
    availableInAllBranches: true,
    branchIds: [],
  };
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
