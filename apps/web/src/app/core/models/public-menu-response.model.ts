import type { BranchOperationalStatus } from './tenant.models';
import type {
  LocalizedText,
  ProductAvailability,
  PromoDiscountType,
  PromotionKind,
  VariantSelectionType,
} from './menu.models';

/**
 * Formas "wire" (DTO tal cual llegan por HTTP) de
 * `GET /api/v1/menu/public/:tenantSlug/:branchSlug`
 * (docs/api-contracts.md §3.5, espejo de `apps/api/src/catalog/catalog.types.ts`
 * y `apps/api/src/public-menu/menu.service.ts`).
 *
 * Se mantienen separadas de los modelos de dominio (`menu.models.ts`,
 * `tenant.models.ts`) a propósito, aunque hoy sean estructuralmente 1:1: si el
 * contrato de API cambia de forma independiente del modelo que consume la UI
 * (ej. se agrega paginación, se renombra un campo), solo hay que tocar los
 * mappers en `tenant-resolver.service.ts`, no todo el árbol de Stores/UI.
 *
 * `meta` y `tenant.branding` (docs/api-contracts.md §3.5) siguen sin
 * implementarse en el backend (pendientes de `MediaModule`) — no forman parte
 * de este tipo todavía.
 */
export interface PublicMenuBranchApiModel {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly timezone: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly operationalStatus: BranchOperationalStatus;
}

export interface ProductVariantOptionApiModel {
  readonly id: string;
  readonly name: LocalizedText;
  readonly priceDelta: number;
  readonly available: boolean;
}

export interface ProductVariantGroupApiModel {
  readonly id: string;
  readonly name: LocalizedText;
  readonly selectionType: VariantSelectionType;
  readonly required: boolean;
  readonly options: readonly ProductVariantOptionApiModel[];
}

/**
 * Espejo de `ActivePromotionNode` (`apps/api/src/catalog/catalog.types.ts`).
 * El backend ya resuelve completamente cuál Promo/Happy Hour gana (prioridad
 * -> especificidad -> recencia, `features-spec.md` §3.2) y el precio final:
 * el frontend nunca recalcula nada de esto, solo pinta lo que llega
 * (docs/api-contracts.md §3.6, "`activePromotion` ya resuelto por el
 * backend").
 */
export interface ActivePromotionApiModel {
  readonly id: string;
  readonly kind: PromotionKind;
  readonly name: LocalizedText;
  readonly badgeLabel: LocalizedText;
  readonly discountType: PromoDiscountType;
  readonly originalPrice: number;
  readonly finalPrice: number;
}

export interface ProductApiModel {
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
  readonly images: {
    readonly thumbnailUrl: string | null;
    readonly detailUrl: string | null;
  };
  readonly webAr: {
    readonly enabled: boolean;
    readonly assetUrl: string | null;
  };
  readonly variantGroups: readonly ProductVariantGroupApiModel[];
  readonly activePromotion: ActivePromotionApiModel | null;
}

/** Nodo recursivo del árbol de categorías (`children` anidado, igual que en el backend). */
export interface CategoryApiModel {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly order: number;
  readonly imageUrl: string | null;
  readonly products: readonly ProductApiModel[];
  readonly children: readonly CategoryApiModel[];
}

export interface ComboItemRefApiModel {
  readonly productId: string;
  readonly quantity: number;
}

export interface ComboApiModel {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly price: number;
  readonly currency: string;
  readonly imageUrl: string | null;
  readonly availability: ProductAvailability;
  readonly items: readonly ComboItemRefApiModel[];
  readonly activePromotion: ActivePromotionApiModel | null;
}

export interface AllergenTagApiModel {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly iconUrl: string | null;
}

export interface DietaryTagApiModel {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly iconUrl: string | null;
}

/** Catálogos globales de plataforma (`Allergen`/`DietaryTag`, sin `tenantId`). */
export interface PlatformCatalogsApiModel {
  readonly allergens: readonly AllergenTagApiModel[];
  readonly dietaryTags: readonly DietaryTagApiModel[];
}

export interface PublicMenuApiResponse {
  readonly branch: PublicMenuBranchApiModel;
  readonly categories: readonly CategoryApiModel[];
  readonly combos: readonly ComboApiModel[];
  readonly catalogs: PlatformCatalogsApiModel;
}
