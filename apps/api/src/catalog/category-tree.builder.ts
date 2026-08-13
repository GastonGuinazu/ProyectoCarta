import type { CategoryRow } from './category/category-row.type';
import type { ProductRow } from './product/product-row.type';
import type {
  CategoryTreeNode,
  ProductNode,
  ProductVariantGroupNode,
} from './catalog.types';

/**
 * Nodo mutable interno usado mientras se arma el árbol. Se convierte a
 * `CategoryTreeNode` (inmutable, `readonly`) implícitamente al devolverlo:
 * las estructuras son estructuralmente compatibles porque acá solo se agregan
 * elementos a `children`/`products`, nunca se reemplazan por otros tipos.
 */
interface MutableCategoryNode {
  id: string;
  slug: string;
  name: CategoryTreeNode['name'];
  description: CategoryTreeNode['description'];
  order: number;
  imageUrl: string | null;
  products: ProductNode[];
  children: MutableCategoryNode[];
}

/**
 * Transforma la lista plana de `CategoryRow` (con `parentId`) en un árbol
 * anidado (`children` recursivo), aplica la poda por herencia de
 * visibilidad/disponibilidad (features-spec.md §2.5), y recién ahí asocia los
 * `ProductRow` a la categoría que les corresponde.
 *
 * Estrategia (ver explicación completa dada al usuario antes de este código):
 * 1. Indexar todas las categorías por `id` en un `Map` — O(n).
 * 2. Enganchar cada nodo a su padre (o a la raíz) en una segunda pasada — O(n).
 *    El orden entre hermanos se preserva porque `categories` ya viene ordenado
 *    por `order` desde `CategoryRepository`, y `push()` respeta ese orden.
 * 3. Podar top-down: un nodo sobrevive solo si él Y todos sus ancestros son
 *    efectivamente visibles/disponibles en esta sucursal. Debe ser top-down
 *    (raíces primero) porque el resultado de un padre condiciona a sus hijos.
 * 4. Asociar cada `ProductRow` a su categoría SOLO si esa categoría sobrevivió
 *    la poda (si la categoría se ocultó por herencia, sus productos tampoco se
 *    muestran, aunque el producto individualmente esté disponible).
 */
export function buildCategoryTree(
  categories: readonly CategoryRow[],
  products: readonly ProductRow[],
): readonly CategoryTreeNode[] {
  const categoryById = new Map<string, CategoryRow>();
  const nodeById = new Map<string, MutableCategoryNode>();

  for (const category of categories) {
    categoryById.set(category.id, category);
    nodeById.set(category.id, {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      order: category.order,
      imageUrl: null,
      products: [],
      children: [],
    });
  }

  const roots: MutableCategoryNode[] = [];
  for (const category of categories) {
    const node = nodeById.get(category.id);
    if (!node) {
      continue;
    }

    if (category.parentId === null) {
      roots.push(node);
      continue;
    }

    const parentNode = nodeById.get(category.parentId);
    if (!parentNode) {
      // `parentId` apunta a una categoría que no está en el set (no debería
      // pasar dado el aislamiento multi-tenant: implicaría un dato corrupto,
      // no un caso de negocio válido). Se promueve a raíz en vez de
      // descartarla silenciosamente, para no ocultar datos por un problema de
      // integridad que merece investigarse aparte.
      roots.push(node);
      continue;
    }

    parentNode.children.push(node);
  }

  function isOwnEffectivelyVisible(categoryId: string): boolean {
    const category = categoryById.get(categoryId);
    return !!category && category.visible && category.isAvailableAtBranch;
  }

  function pruneSubtree(
    node: MutableCategoryNode,
    ancestorsEffectivelyVisible: boolean,
  ): MutableCategoryNode | null {
    const effectivelyVisible =
      ancestorsEffectivelyVisible && isOwnEffectivelyVisible(node.id);
    if (!effectivelyVisible) {
      return null;
    }

    node.children = node.children
      .map((child) => pruneSubtree(child, true))
      .filter((child): child is MutableCategoryNode => child !== null);

    return node;
  }

  const prunedRoots = roots
    .map((root) => pruneSubtree(root, true))
    .filter((root): root is MutableCategoryNode => root !== null);

  const survivingCategoryIds = new Set<string>();
  function collectSurvivingIds(node: MutableCategoryNode): void {
    survivingCategoryIds.add(node.id);
    node.children.forEach(collectSurvivingIds);
  }
  prunedRoots.forEach(collectSurvivingIds);

  for (const product of products) {
    if (!survivingCategoryIds.has(product.categoryId)) {
      continue;
    }
    nodeById.get(product.categoryId)?.products.push(toProductNode(product));
  }

  return prunedRoots;
}

function toProductNode(product: ProductRow): ProductNode {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    basePrice: product.basePriceCents,
    currency: product.currency,
    availability: product.availability,
    order: product.order,
    allergenIds: product.allergenIds,
    dietaryTagIds: product.dietaryTagIds,
    images: { thumbnailUrl: null, detailUrl: null },
    webAr: { enabled: false, assetUrl: null },
    variantGroups: product.variantGroups.map(toVariantGroupNode),
    activePromotion: null,
  };
}

function toVariantGroupNode(
  group: ProductRow['variantGroups'][number],
): ProductVariantGroupNode {
  return {
    id: group.id,
    name: group.name,
    selectionType: group.selectionType,
    required: group.required,
    options: group.options.map((option) => ({
      id: option.id,
      name: option.name,
      priceDelta: option.priceDeltaCents,
      available: option.available,
    })),
  };
}
