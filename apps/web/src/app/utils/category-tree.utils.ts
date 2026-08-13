import type { CategoryNode, ProductSummary } from '../core/models/menu.models';

/**
 * Funciones puras de recorrido del árbol de categorías
 * (docs/frontend-architecture.md §4.1 — capa `utils/`: "recorrido/aplanado del
 * árbol de categorías"). No dependen de Angular ni de ningún Store (`inject()`
 * prohibido en esta capa, docs/frontend-architecture.md §4.2).
 */

/**
 * Devuelve una copia filtrada del árbol de categorías: oculta los productos que
 * contengan alguno de los alérgenos excluidos, y oculta las categorías que quedan
 * sin productos visibles ni hijos visibles tras el filtro (herencia de
 * visibilidad, features-spec.md §2.5, citada en docs/frontend-architecture.md
 * §2.8).
 */
export function filterCategoryTreeByExcludedAllergens(
  categories: readonly CategoryNode[],
  excludedAllergenIds: ReadonlySet<string>,
): readonly CategoryNode[] {
  if (excludedAllergenIds.size === 0) {
    return categories;
  }

  const visibleNodes: CategoryNode[] = [];

  for (const category of categories) {
    const visibleProducts = category.products.filter(
      (product) => !productHasExcludedAllergen(product, excludedAllergenIds),
    );
    const visibleChildren = filterCategoryTreeByExcludedAllergens(
      category.children,
      excludedAllergenIds,
    );

    if (visibleProducts.length === 0 && visibleChildren.length === 0) {
      continue;
    }

    visibleNodes.push({ ...category, products: visibleProducts, children: visibleChildren });
  }

  return visibleNodes;
}

function productHasExcludedAllergen(
  product: ProductSummary,
  excludedAllergenIds: ReadonlySet<string>,
): boolean {
  return product.allergenIds.some((allergenId) => excludedAllergenIds.has(allergenId));
}

/** Cuenta recursivamente los productos visibles en un árbol de categorías (ya filtrado o no). */
export function countProductsInTree(categories: readonly CategoryNode[]): number {
  return categories.reduce(
    (total, category) => total + category.products.length + countProductsInTree(category.children),
    0,
  );
}
