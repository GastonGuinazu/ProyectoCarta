import type { AdminDiscountType, AdminHappyHour, AdminPromo } from './admin-engagement.models';
import type { LocalizedText } from '../../../core/models/menu.models';
import { localizedTextMatches } from '../../../utils/localized-text.utils';
import { majorUnitsToCents } from '../../../utils/price.utils';

export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

export function basisPointsToPercent(bp: number): number {
  return bp / 100;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function toIsoFromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function discountFieldsFromForm(
  discountType: AdminDiscountType,
  percent: number,
  amount: number,
): {
  readonly discountPercentageBp?: number;
  readonly discountAmountCents?: number;
  readonly fixedPriceCents?: number;
} {
  if (discountType === 'PERCENTAGE') {
    return { discountPercentageBp: percentToBasisPoints(percent) };
  }
  if (discountType === 'FIXED_AMOUNT') {
    return { discountAmountCents: majorUnitsToCents(amount) };
  }
  return { fixedPriceCents: majorUnitsToCents(amount) };
}

export interface OfferTargetSource {
  readonly id: string;
  readonly name: LocalizedText;
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
}

export interface ProductCategoryRef {
  readonly id: string;
  readonly categoryId: string;
}

export function filterNamedItems<T extends { readonly id: string; readonly name: LocalizedText }>(
  items: readonly T[],
  query: string,
  selectedIds: readonly string[],
): readonly T[] {
  const selected = new Set(selectedIds);
  return items.filter(
    (item) => selected.has(item.id) || localizedTextMatches(item.name, query),
  );
}

/**
 * Otras ofertas que cubren los mismos platos o categorías. Una sola gana
 * (prioridad → especificidad → recencia; features-spec.md §3.2).
 */
export function findOverlappingOffers(
  selectedProductIds: readonly string[],
  selectedCategoryIds: readonly string[],
  products: readonly ProductCategoryRef[],
  others: readonly OfferTargetSource[],
): readonly OfferTargetSource[] {
  if (selectedProductIds.length === 0 && selectedCategoryIds.length === 0) {
    return [];
  }

  const selectedProducts = new Set(selectedProductIds);
  const selectedCategories = new Set(selectedCategoryIds);
  const categoryByProduct = new Map(
    products.map((product) => [product.id, product.categoryId]),
  );

  return others.filter((other) => {
    if (other.productIds.some((id) => selectedProducts.has(id))) {
      return true;
    }
    if (other.categoryIds.some((id) => selectedCategories.has(id))) {
      return true;
    }
    if (
      other.productIds.some((id) => {
        const categoryId = categoryByProduct.get(id);
        return Boolean(categoryId && selectedCategories.has(categoryId));
      })
    ) {
      return true;
    }
    return selectedProductIds.some((id) => {
      const categoryId = categoryByProduct.get(id);
      return Boolean(categoryId && other.categoryIds.includes(categoryId));
    });
  });
}

export function toOfferTargetSource(
  item: AdminPromo | AdminHappyHour,
): OfferTargetSource {
  return {
    id: item.id,
    name: item.name,
    productIds: item.productIds,
    categoryIds: item.categoryIds,
  };
}
