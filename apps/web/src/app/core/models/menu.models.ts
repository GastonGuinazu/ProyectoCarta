/**
 * Formas de datos que reflejan el resto del payload de
 * `GET /api/v1/menu/public/:tenantSlug/:branchSlug` (docs/api-contracts.md §3.5):
 * `catalogs`, `categories` (árbol anidado) y `combos`. Debe mantenerse sincronizado
 * manualmente con ese contrato (docs/frontend-architecture.md §4.3).
 */

/** Objeto `{ "<códigoIdioma>": "<valor>" }` — nunca un string plano (features-spec.md §6). */
export type LocalizedText = Record<string, string>;

export type ProductAvailability = 'AVAILABLE' | 'OUT_OF_STOCK' | 'DISCONTINUED';
export type PromoDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE';
export type VariantSelectionType = 'SINGLE' | 'MULTIPLE';
export type PromotionKind = 'PROMO' | 'HAPPY_HOUR';

export interface AllergenTag {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly iconUrl: string | null;
}

export interface DietaryTagInfo {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly iconUrl: string | null;
}

export interface VariantOption {
  readonly id: string;
  readonly name: LocalizedText;
  readonly priceDelta: number;
  readonly available: boolean;
}

export interface VariantGroup {
  readonly id: string;
  readonly name: LocalizedText;
  readonly selectionType: VariantSelectionType;
  readonly required: boolean;
  readonly options: readonly VariantOption[];
}

export interface ActivePromotion {
  readonly id: string;
  readonly kind: PromotionKind;
  readonly name: LocalizedText;
  readonly badgeLabel: LocalizedText;
  readonly discountType: PromoDiscountType;
  readonly originalPrice: number;
  readonly finalPrice: number;
}

export interface ProductSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly basePrice: number;
  readonly currency: string;
  readonly availability: ProductAvailability;
  readonly order: number;
  readonly allergenIds: readonly string[];
  readonly dietaryTagIds: readonly string[];
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
  readonly outsideServingHours: boolean;
  readonly images: {
    readonly thumbnailUrl: string | null;
    readonly detailUrl: string | null;
  };
  readonly webAr: {
    readonly enabled: boolean;
    readonly assetUrl: string | null;
    readonly modelUrl: string | null;
  };
  readonly variantGroups: readonly VariantGroup[];
  readonly activePromotion: ActivePromotion | null;
}

/** Nodo recursivo del árbol de categorías (`children` anidado, nunca `parentId` plano). */
export interface CategoryNode {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly order: number;
  readonly imageUrl: string | null;
  readonly products: readonly ProductSummary[];
  readonly children: readonly CategoryNode[];
}

export interface ComboItemRef {
  readonly productId: string;
  readonly quantity: number;
}

export interface ComboSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly price: number;
  readonly currency: string;
  readonly imageUrl: string | null;
  readonly availability: ProductAvailability;
  readonly items: readonly ComboItemRef[];
  readonly activePromotion: ActivePromotion | null;
}

/** Refleja el `syncStatus` de `MenuStore` (docs/frontend-architecture.md §2.4). */
export type MenuSyncStatus = 'hydratingFromCache' | 'synced' | 'revalidating' | 'offline' | 'error';

/** Payload completo que `MenuStore` puede aplicar de una sola vez (hidratación o revalidación). */
export interface MenuSnapshot {
  readonly categoriesTree: readonly CategoryNode[];
  readonly combos: readonly ComboSummary[];
  readonly allergenCatalog: readonly AllergenTag[];
  readonly dietaryTagCatalog: readonly DietaryTagInfo[];
  readonly menuVersion: string | null;
}
