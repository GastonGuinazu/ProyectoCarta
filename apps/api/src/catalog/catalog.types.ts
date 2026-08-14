import type {
  AvailabilityStatus,
  PromoDiscountType,
  VariantSelectionType,
} from '@prisma/client';
import type { LocalizedText } from '../core';

/**
 * Formas de salida del dominio Catalog, alineadas 1:1 a `categories`/`products`
 * de docs/api-contracts.md §3.5. `CatalogService` deja `imageUrl`, `images` y
 * `webAr` en su valor "vacío" honesto (nunca fabrica URLs falsas): quien los
 * puebla es `PublicMenuModule`, cruzando con `MediaModule` vía
 * `apply-media-urls.util.ts` (mismo patrón que `activePromotion`/Engagement).
 */

/**
 * `ActivePromotionNode` se define ACÁ (dominio Catalog) y no en
 * `EngagementModule`, a propósito: `docs/domain-modules.md` §4.5 establece que
 * "Engagement depende de Catalog" (no al revés), y este es el contrato de
 * salida de un campo que vive en `ProductNode`/`ComboNode`. `EngagementModule`
 * importa este tipo (import de tipo únicamente, sin acoplar módulos de Nest:
 * `CatalogModule` no importa ni depende de `EngagementModule` en ningún
 * sentido de inyección de dependencias).
 *
 * `CatalogService` nunca puebla este campo (siempre lo deja en `null`, ver
 * `category-tree.builder.ts`): quien lo resuelve es `EngagementService`,
 * cruzado por `PublicMenuModule` (`apply-active-promotions.util.ts`).
 */
export type PromotionKind = 'PROMO' | 'HAPPY_HOUR';

export interface ActivePromotionNode {
  readonly id: string;
  readonly kind: PromotionKind;
  readonly name: LocalizedText;
  readonly badgeLabel: LocalizedText;
  readonly discountType: PromoDiscountType;
  readonly originalPrice: number;
  readonly finalPrice: number;
}

export interface ProductVariantOptionNode {
  readonly id: string;
  readonly name: LocalizedText;
  readonly priceDelta: number;
  readonly available: boolean;
}

export interface ProductVariantGroupNode {
  readonly id: string;
  readonly name: LocalizedText;
  readonly selectionType: VariantSelectionType;
  readonly required: boolean;
  readonly options: readonly ProductVariantOptionNode[];
}

export interface ProductNode {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly basePrice: number;
  readonly currency: string;
  readonly availability: AvailabilityStatus;
  readonly order: number;
  readonly allergenIds: readonly string[];
  readonly dietaryTagIds: readonly string[];
  /**
   * Minutos `[0, 1439]` en la zona IANA de la sucursal. Ambos `null` = sin
   * recorte horario. El fin es exclusivo. `CatalogService` no evalúa "ahora":
   * `outsideServingHours` lo puebla `PublicMenuModule`.
   */
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
  /** Poblado por `PublicMenuModule` vía `apply-serving-hours.util.ts`; `false` en Catalog. */
  readonly outsideServingHours: boolean;
  /** Poblado por `PublicMenuModule` vía `apply-media-urls.util.ts`, a partir del `MediaAsset` marcado `role: PRIMARY`. */
  readonly images: {
    readonly thumbnailUrl: string | null;
    readonly detailUrl: string | null;
  };
  /** Poblado por `PublicMenuModule` vía `apply-media-urls.util.ts`.
   * `images` sale del `MediaAsset` `PRIMARY` (foto 2D).
   * `modelUrl` sale de un `MediaAsset` distinto con rol `AR_MODEL` (`.glb`/`.usdz`).
   * `assetUrl` sigue siendo el recorte AR 2D derivado de la foto. */
  readonly webAr: {
    readonly enabled: boolean;
    readonly assetUrl: string | null;
    readonly modelUrl: string | null;
  };
  readonly variantGroups: readonly ProductVariantGroupNode[];
  /** Poblado por `EngagementModule` vía `apply-active-promotions.util.ts`; `null` si no hay ninguna Promo/Happy Hour vigente. */
  readonly activePromotion: ActivePromotionNode | null;
}

/** Nodo recursivo del árbol de categorías (`children` anidado, nunca `parentId` plano). */
export interface CategoryTreeNode {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly order: number;
  /** Poblado por `PublicMenuModule` vía `apply-media-urls.util.ts` (URL de la variante `DETAIL`). */
  readonly imageUrl: string | null;
  readonly products: readonly ProductNode[];
  readonly children: readonly CategoryTreeNode[];
}

/**
 * Referencia liviana a un producto dentro de un Combo. Deliberadamente NO
 * incluye el detalle completo del producto (nombre, precio, etc.): el
 * contrato público (docs/api-contracts.md §3.5) solo expone `productId` +
 * `quantity` por ítem — el detalle completo ya viaja, si corresponde, dentro
 * de `categories[].products` en la misma respuesta.
 */
export interface ComboItemRefNode {
  readonly productId: string;
  readonly quantity: number;
}

export interface ComboNode {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly price: number;
  readonly currency: string;
  /** Poblado por `PublicMenuModule` vía `apply-media-urls.util.ts` (URL de la variante `DETAIL`). */
  readonly imageUrl: string | null;
  readonly availability: AvailabilityStatus;
  readonly items: readonly ComboItemRefNode[];
  /** Poblado por `EngagementModule` vía `apply-active-promotions.util.ts`; `null` si no hay ninguna Promo/Happy Hour vigente. */
  readonly activePromotion: ActivePromotionNode | null;
}

/** Catálogos globales de plataforma referenciados por `allergenIds`/`dietaryTagIds` en `products`. */
export interface AllergenTagNode {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly iconUrl: string | null;
}

export interface DietaryTagNode {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly iconUrl: string | null;
}

export interface PlatformCatalogs {
  readonly allergens: readonly AllergenTagNode[];
  readonly dietaryTags: readonly DietaryTagNode[];
}
