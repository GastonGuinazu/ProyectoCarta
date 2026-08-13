import type { AvailabilityStatus } from '@prisma/client';
import type { LocalizedText } from '../../core';

/**
 * Detalle mínimo del producto asociado a un `ComboItem`, tal como lo pidió
 * el ticket ("incluyendo... los detalles del producto asociado"). No se
 * serializa completo en la respuesta pública (el contrato de
 * docs/api-contracts.md §3.5 solo pide `productId`/`quantity` por ítem), pero
 * queda disponible en esta fila cruda para validaciones futuras (ej. excluir
 * o marcar combos que referencian productos descontinuados) sin tener que
 * volver a consultar la base de datos.
 */
export interface ComboItemProductRow {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
}

export interface ComboItemRow {
  readonly productId: string;
  readonly quantity: number;
  readonly product: ComboItemProductRow;
}

/**
 * Fila cruda de `Combo` mapeada a un DTO de dominio. A diferencia de
 * `Category`, un Combo no tiene descendientes cuya visibilidad dependa de él
 * (no hay jerarquía), así que filtrar por disponibilidad de sucursal y
 * vigencia temporal directamente en la consulta es seguro (ver
 * `combo.repository.ts`).
 */
export interface ComboRow {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly priceCents: number;
  readonly currency: string;
  readonly imageMediaAssetId: string | null;
  readonly availability: AvailabilityStatus;
  readonly items: readonly ComboItemRow[];
}
