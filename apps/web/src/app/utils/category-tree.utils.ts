import type { CategoryNode, ComboSummary, ProductSummary } from '../core/models/menu.models';
import { localizedTextMatches } from './localized-text.utils';

/**
 * Funciones puras de recorrido del árbol de categorías
 * (docs/frontend-architecture.md §4.1 — capa `utils/`: "recorrido/aplanado del
 * árbol de categorías"). No dependen de Angular ni de ningún Store (`inject()`
 * prohibido en esta capa, docs/frontend-architecture.md §4.2).
 */

/**
 * `true` si el producto sobrevive a los filtros activos:
 * - no contiene ningún alérgeno excluido;
 * - incluye **todos** los tags dietéticos requeridos (AND).
 */
export function productMatchesVisibilityFilters(
  product: ProductSummary,
  excludedAllergenIds: ReadonlySet<string>,
  requiredDietaryTagIds: ReadonlySet<string>,
): boolean {
  if (product.allergenIds.some((allergenId) => excludedAllergenIds.has(allergenId))) {
    return false;
  }

  for (const tagId of requiredDietaryTagIds) {
    if (!product.dietaryTagIds.includes(tagId)) {
      return false;
    }
  }

  return true;
}

/**
 * Devuelve una copia filtrada del árbol de categorías: oculta los productos que
 * no cumplen los filtros de alérgenos (exclusión) y/o dietéticos (inclusión),
 * y oculta las categorías que quedan sin productos visibles ni hijos visibles
 * (herencia de visibilidad, features-spec.md §2.5, citada en
 * docs/frontend-architecture.md §2.8).
 */
export function filterCategoryTreeByVisibilityFilters(
  categories: readonly CategoryNode[],
  excludedAllergenIds: ReadonlySet<string>,
  requiredDietaryTagIds: ReadonlySet<string>,
): readonly CategoryNode[] {
  if (excludedAllergenIds.size === 0 && requiredDietaryTagIds.size === 0) {
    return categories;
  }

  const visibleNodes: CategoryNode[] = [];

  for (const category of categories) {
    const visibleProducts = category.products.filter((product) =>
      productMatchesVisibilityFilters(product, excludedAllergenIds, requiredDietaryTagIds),
    );
    const visibleChildren = filterCategoryTreeByVisibilityFilters(
      category.children,
      excludedAllergenIds,
      requiredDietaryTagIds,
    );

    if (visibleProducts.length === 0 && visibleChildren.length === 0) {
      continue;
    }

    visibleNodes.push({ ...category, products: visibleProducts, children: visibleChildren });
  }

  return visibleNodes;
}

/**
 * Alias conservado para llamadas que solo excluyen alérgenos.
 * Delega en `filterCategoryTreeByVisibilityFilters` sin tags dietéticos.
 */
export function filterCategoryTreeByExcludedAllergens(
  categories: readonly CategoryNode[],
  excludedAllergenIds: ReadonlySet<string>,
): readonly CategoryNode[] {
  return filterCategoryTreeByVisibilityFilters(categories, excludedAllergenIds, new Set());
}

/** Índice id → producto a partir del árbol (fuente única: `categoriesTree`). */
export function indexProductsById(
  categories: readonly CategoryNode[],
): ReadonlyMap<string, ProductSummary> {
  const productsById = new Map<string, ProductSummary>();

  const walk = (nodes: readonly CategoryNode[]): void => {
    for (const node of nodes) {
      for (const product of node.products) {
        productsById.set(product.id, product);
      }
      walk(node.children);
    }
  };

  walk(categories);
  return productsById;
}

/**
 * Oculta combos cuyos items no cumplen los filtros activos. Si un `productId`
 * no se resuelve en el árbol, el item no descarta el combo (el catálogo puede
 * referenciar un producto aún no hidratado).
 */
export function filterCombosByVisibilityFilters(
  combos: readonly ComboSummary[],
  productsById: ReadonlyMap<string, ProductSummary>,
  excludedAllergenIds: ReadonlySet<string>,
  requiredDietaryTagIds: ReadonlySet<string>,
): readonly ComboSummary[] {
  if (excludedAllergenIds.size === 0 && requiredDietaryTagIds.size === 0) {
    return combos;
  }

  return combos.filter((combo) =>
    combo.items.every((item) => {
      const product = productsById.get(item.productId);
      if (!product) {
        return true;
      }
      return productMatchesVisibilityFilters(product, excludedAllergenIds, requiredDietaryTagIds);
    }),
  );
}

export function productMatchesSearch(product: ProductSummary, query: string): boolean {
  return (
    localizedTextMatches(product.name, query) || localizedTextMatches(product.description, query)
  );
}

/**
 * Filtra el árbol por nombre o descripción del plato (client-side, mismo
 * patrón que los filtros de alérgenos). Cadena vacía = identidad.
 */
export function filterCategoryTreeBySearch(
  categories: readonly CategoryNode[],
  query: string,
): readonly CategoryNode[] {
  if (!query.trim()) {
    return categories;
  }

  const visibleNodes: CategoryNode[] = [];

  for (const category of categories) {
    const visibleProducts = category.products.filter((product) =>
      productMatchesSearch(product, query),
    );
    const visibleChildren = filterCategoryTreeBySearch(category.children, query);

    if (visibleProducts.length === 0 && visibleChildren.length === 0) {
      continue;
    }

    visibleNodes.push({ ...category, products: visibleProducts, children: visibleChildren });
  }

  return visibleNodes;
}

export function comboMatchesSearch(combo: ComboSummary, query: string): boolean {
  return localizedTextMatches(combo.name, query) || localizedTextMatches(combo.description, query);
}

export function filterCombosBySearch(
  combos: readonly ComboSummary[],
  query: string,
): readonly ComboSummary[] {
  if (!query.trim()) {
    return combos;
  }
  return combos.filter((combo) => comboMatchesSearch(combo, query));
}

/**
 * Productos cuya oferta ganadora es un Happy Hour, en el orden del árbol
 * (sin duplicar si el mismo plato aparece en más de una categoría).
 */
export function collectHappyHourProducts(
  categories: readonly CategoryNode[],
): readonly ProductSummary[] {
  const seen = new Set<string>();
  const items: ProductSummary[] = [];

  const walk = (nodes: readonly CategoryNode[]): void => {
    for (const node of nodes) {
      for (const product of node.products) {
        if (product.activePromotion?.kind !== 'HAPPY_HOUR' || seen.has(product.id)) {
          continue;
        }
        seen.add(product.id);
        items.push(product);
      }
      walk(node.children);
    }
  };

  walk(categories);
  return items;
}

/** Cuenta recursivamente los productos visibles en un árbol de categorías (ya filtrado o no). */
export function countProductsInTree(categories: readonly CategoryNode[]): number {
  return categories.reduce(
    (total, category) => total + category.products.length + countProductsInTree(category.children),
    0,
  );
}
