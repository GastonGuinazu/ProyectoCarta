import type { AvailabilityStatus, VariantSelectionType } from '@prisma/client';
import type { LocalizedText } from '../../core';

export interface ProductVariantOptionRow {
  readonly id: string;
  readonly name: LocalizedText;
  readonly priceDeltaCents: number;
  readonly available: boolean;
  readonly order: number;
}

export interface ProductVariantGroupRow {
  readonly id: string;
  readonly name: LocalizedText;
  readonly selectionType: VariantSelectionType;
  readonly required: boolean;
  readonly order: number;
  readonly options: readonly ProductVariantOptionRow[];
}

/**
 * Fila cruda de `Product` mapeada a un DTO de dominio, ya filtrada por
 * disponibilidad en la sucursal solicitada (a diferencia de `CategoryRow`, un
 * Producto no tiene descendientes cuya visibilidad dependa de él, así que
 * filtrar en la propia consulta es seguro — ver `product.repository.ts`).
 */
export interface ProductRow {
  readonly id: string;
  readonly categoryId: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly basePriceCents: number;
  readonly currency: string;
  readonly availability: AvailabilityStatus;
  readonly order: number;
  readonly allergenIds: readonly string[];
  readonly dietaryTagIds: readonly string[];
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
  /**
   * Id del `MediaAsset` asociado vía `ProductMedia` con `role: PRIMARY`
   * e `fileType: IMAGE` (`null` si todavía no hay foto de presentación).
   * Pendiente de resolverse a una URL real por `MediaModule` — ver
   * `CatalogService.getFullCatalogForBranch` y
   * `public-menu/apply-media-urls.util.ts`.
   */
  readonly primaryMediaAssetId: string | null;
  /**
   * Id del `MediaAsset` con `role: AR_MODEL` (`.glb`/`.usdz` opcional).
   * Independiente de `primaryMediaAssetId`: un producto puede tener ambos.
   */
  readonly arModelMediaAssetId: string | null;
  readonly variantGroups: readonly ProductVariantGroupRow[];
}
