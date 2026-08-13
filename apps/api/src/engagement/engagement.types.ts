import type { ActivePromotionNode } from '../catalog/catalog.types';

/**
 * Contrato que expone `EngagementService.getActivePromotionsForBranch`:
 * un resolver ya armado (candidatos indexados, ganador por prioridad ->
 * especificidad -> recencia ya resuelto internamente) en vez de la lista
 * cruda de Promos/Happy Hours activos. Quien lo consume (`PublicMenuModule`,
 * ver `apply-active-promotions.util.ts`) solo necesita llamarlo por cada
 * Producto/Combo del árbol de Catalog — no reimplementa ninguna regla de
 * negocio de Engagement.
 */
export interface ActivePromotionsResolver {
  resolveForProduct(
    productId: string,
    categoryId: string,
    basePriceCents: number,
  ): ActivePromotionNode | null;

  resolveForCombo(
    comboId: string,
    basePriceCents: number,
  ): ActivePromotionNode | null;
}
