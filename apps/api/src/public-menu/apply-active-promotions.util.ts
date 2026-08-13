import type { ActivePromotionsResolver } from '../engagement/engagement.types';
import type {
  CategoryTreeNode,
  ComboNode,
  ProductNode,
} from '../catalog/catalog.types';

export interface CatalogWithActivePromotions {
  readonly categories: readonly CategoryTreeNode[];
  readonly combos: readonly ComboNode[];
}

/**
 * "Cruce" entre el árbol de Catalog (ya armado por `CatalogService`, con
 * `activePromotion: null` en todos sus nodos) y el `resolver` de
 * `EngagementService`: recorre categorías/productos/combos y reemplaza
 * `activePromotion` por el resultado de `resolveForProduct`/`resolveForCombo`.
 *
 * Función pura, sin DI (mismo patrón que `category-tree.builder.ts`): no
 * reimplementa ninguna regla de prioridad/especificidad/recencia, solo
 * recorre la estructura y delega la decisión en el `resolver` recibido.
 * Reconstruye los nodos en vez de mutarlos (los tipos de `catalog.types.ts`
 * son `readonly`).
 */
export function applyActivePromotions(
  categories: readonly CategoryTreeNode[],
  combos: readonly ComboNode[],
  resolver: ActivePromotionsResolver,
): CatalogWithActivePromotions {
  return {
    categories: categories.map((category) =>
      applyToCategory(category, resolver),
    ),
    combos: combos.map((combo) => applyToCombo(combo, resolver)),
  };
}

function applyToCategory(
  category: CategoryTreeNode,
  resolver: ActivePromotionsResolver,
): CategoryTreeNode {
  return {
    ...category,
    products: category.products.map((product) =>
      applyToProduct(product, category.id, resolver),
    ),
    children: category.children.map((child) =>
      applyToCategory(child, resolver),
    ),
  };
}

function applyToProduct(
  product: ProductNode,
  categoryId: string,
  resolver: ActivePromotionsResolver,
): ProductNode {
  return {
    ...product,
    activePromotion: resolver.resolveForProduct(
      product.id,
      categoryId,
      product.basePrice,
    ),
  };
}

function applyToCombo(
  combo: ComboNode,
  resolver: ActivePromotionsResolver,
): ComboNode {
  return {
    ...combo,
    activePromotion: resolver.resolveForCombo(combo.id, combo.price),
  };
}
