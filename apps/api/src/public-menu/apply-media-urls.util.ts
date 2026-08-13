import type { ResolvedMediaAsset } from '../media/media.types';
import type {
  CategoryTreeNode,
  ComboNode,
  ProductNode,
} from '../catalog/catalog.types';

/**
 * Referencias crudas (`entidad.id -> mediaAssetId`) que `CatalogService`
 * recolectó junto con el árbol/combos (`CategoryTreeResult`/`ComboListResult`),
 * más el resultado en batch de `MediaService.resolveMediaAssets`. Es la
 * entrada de esta función pura: ella no dispara NINGUNA consulta, solo hace
 * lookups en los `Map` ya resueltos por el caller (`MenuService`).
 */
export interface MediaAssetReferences {
  readonly categoryImageAssetIds: ReadonlyMap<string, string>;
  readonly productPrimaryAssetIds: ReadonlyMap<string, string>;
  readonly comboImageAssetIds: ReadonlyMap<string, string>;
}

export interface CatalogWithMediaUrls {
  readonly categories: readonly CategoryTreeNode[];
  readonly combos: readonly ComboNode[];
}

/**
 * "Cruce" entre el árbol de Catalog (con `imageUrl`/`images`/`webAr` todavía
 * en su valor vacío honesto) y el batch ya resuelto por `MediaModule`:
 * recorre categorías/productos/combos y reemplaza esos campos por las URLs
 * concretas, vía lookups `O(1)` en los `Map` recibidos — cero consultas
 * nuevas (ver la estrategia anti-N+1 explicada al usuario).
 *
 * Función pura, sin DI (mismo patrón que `apply-active-promotions.util.ts`):
 * reconstruye los nodos en vez de mutarlos, porque los tipos de
 * `catalog.types.ts` son `readonly`.
 */
export function applyMediaUrls(
  categories: readonly CategoryTreeNode[],
  combos: readonly ComboNode[],
  references: MediaAssetReferences,
  resolvedMedia: ReadonlyMap<string, ResolvedMediaAsset>,
): CatalogWithMediaUrls {
  return {
    categories: categories.map((category) =>
      applyToCategory(category, references, resolvedMedia),
    ),
    combos: combos.map((combo) => applyToCombo(combo, references, resolvedMedia)),
  };
}

function applyToCategory(
  category: CategoryTreeNode,
  references: MediaAssetReferences,
  resolvedMedia: ReadonlyMap<string, ResolvedMediaAsset>,
): CategoryTreeNode {
  const resolved = lookupResolvedAsset(
    category.id,
    references.categoryImageAssetIds,
    resolvedMedia,
  );

  return {
    ...category,
    imageUrl: resolved?.detailUrl ?? null,
    products: category.products.map((product) =>
      applyToProduct(product, references, resolvedMedia),
    ),
    children: category.children.map((child) =>
      applyToCategory(child, references, resolvedMedia),
    ),
  };
}

function applyToProduct(
  product: ProductNode,
  references: MediaAssetReferences,
  resolvedMedia: ReadonlyMap<string, ResolvedMediaAsset>,
): ProductNode {
  const resolved = lookupResolvedAsset(
    product.id,
    references.productPrimaryAssetIds,
    resolvedMedia,
  );

  return {
    ...product,
    images: {
      thumbnailUrl: resolved?.thumbnailUrl ?? null,
      detailUrl: resolved?.detailUrl ?? null,
    },
    webAr: {
      enabled: !!resolved?.arCutoutUrl,
      assetUrl: resolved?.arCutoutUrl ?? null,
    },
  };
}

function applyToCombo(
  combo: ComboNode,
  references: MediaAssetReferences,
  resolvedMedia: ReadonlyMap<string, ResolvedMediaAsset>,
): ComboNode {
  const resolved = lookupResolvedAsset(
    combo.id,
    references.comboImageAssetIds,
    resolvedMedia,
  );

  return {
    ...combo,
    imageUrl: resolved?.detailUrl ?? null,
  };
}

function lookupResolvedAsset(
  entityId: string,
  assetIdsByEntityId: ReadonlyMap<string, string>,
  resolvedMedia: ReadonlyMap<string, ResolvedMediaAsset>,
): ResolvedMediaAsset | undefined {
  const assetId = assetIdsByEntityId.get(entityId);
  return assetId ? resolvedMedia.get(assetId) : undefined;
}
