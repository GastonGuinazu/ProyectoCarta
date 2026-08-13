import type { LocalizedText } from '../../core';

/**
 * Fila cruda de `Category` mapeada a un DTO de dominio, sin filtrar todavía por
 * herencia de visibilidad/disponibilidad (esa combinación con los ancestros vive
 * en `CatalogService`/`category-tree.builder.ts`, no acá).
 *
 * `visible` y `isAvailableAtBranch` reflejan ÚNICAMENTE el flag propio de esta
 * categoría, sin considerar a sus ancestros (features-spec.md §2.5).
 */
export interface CategoryRow {
  readonly id: string;
  readonly parentId: string | null;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly order: number;
  readonly visible: boolean;
  /** Se resuelve a una URL real en `PublicMenuModule` vía `apply-media-urls.util.ts` (ver `MediaModule`). */
  readonly imageMediaAssetId: string | null;
  readonly isAvailableAtBranch: boolean;
}
