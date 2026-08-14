import {
  isWithinMinuteWindow,
  resolveBranchLocalMoment,
} from '../engagement/branch-local-time.util';
import type { CategoryTreeNode, ProductNode } from '../catalog/catalog.types';

/**
 * Cruce entre el árbol de Catalog (con `outsideServingHours: false`) y la
 * hora local de la sucursal. Misma regla de ventana que Happy Hour: el fin
 * es exclusivo y puede cruzar medianoche. Función pura, sin DI.
 *
 * No muta `availability`: un plato agotado sigue agotado; uno con horario
 * queda visible con `outsideServingHours: true` cuando no se sirve ahora.
 */
export function applyServingHours(
  categories: readonly CategoryTreeNode[],
  timezone: string,
  now: Date,
): readonly CategoryTreeNode[] {
  const { minuteOfDay } = resolveBranchLocalMoment(now, timezone);
  return categories.map((category) => applyToCategory(category, minuteOfDay));
}

function applyToCategory(
  category: CategoryTreeNode,
  minuteOfDay: number,
): CategoryTreeNode {
  return {
    ...category,
    products: category.products.map((product) =>
      applyToProduct(product, minuteOfDay),
    ),
    children: category.children.map((child) =>
      applyToCategory(child, minuteOfDay),
    ),
  };
}

function applyToProduct(
  product: ProductNode,
  minuteOfDay: number,
): ProductNode {
  return {
    ...product,
    outsideServingHours: isOutsideServingHours(product, minuteOfDay),
  };
}

function isOutsideServingHours(
  product: Pick<
    ProductNode,
    'servedStartMinuteOfDay' | 'servedEndMinuteOfDay'
  >,
  minuteOfDay: number,
): boolean {
  if (
    product.servedStartMinuteOfDay === null ||
    product.servedEndMinuteOfDay === null
  ) {
    return false;
  }
  return !isWithinMinuteWindow(
    minuteOfDay,
    product.servedStartMinuteOfDay,
    product.servedEndMinuteOfDay,
  );
}
