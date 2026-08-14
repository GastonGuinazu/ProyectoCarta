import {
  isWithinMinuteWindow,
  resolveBranchLocalMoment,
} from '../engagement/branch-local-time.util';
import type { CategoryTreeNode, ProductNode } from '../catalog/catalog.types';
import type { ServingWindow } from '../catalog/product/serving-windows';

/**
 * Cruce entre el árbol de Catalog y la hora local de la sucursal.
 * Un plato está en horario si cae en CUALQUIERA de sus franjas.
 * El fin de cada franja es exclusivo y puede cruzar medianoche.
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
    outsideServingHours: isOutsideServingWindows(
      product.servedWindows,
      minuteOfDay,
    ),
  };
}

function isOutsideServingWindows(
  windows: readonly ServingWindow[],
  minuteOfDay: number,
): boolean {
  if (!windows || windows.length === 0) {
    return false;
  }
  return !windows.some((window) =>
    isWithinMinuteWindow(
      minuteOfDay,
      window.startMinuteOfDay,
      window.endMinuteOfDay,
    ),
  );
}
