import type { PromoDiscountType } from '@prisma/client';
import type {
  ActivePromotionNode,
  PromotionKind,
} from '../catalog/catalog.types';
import type { LocalizedText } from '../core';

export type PromotionSpecificity = 'PRODUCT' | 'CATEGORY' | 'COMBO';

/**
 * Representación normalizada de una Promo o un Happy Hour como candidato a
 * aplicarse sobre una entidad concreta (Producto o Combo). Ambos tipos de
 * origen (`kind`) comparten exactamente este shape y compiten en el mismo
 * pool de candidatos (ver `pickWinningCandidate`), porque
 * `docs/domain-modules.md` §4.2 los trata como la misma familia de reglas de
 * resolución de solapamiento.
 */
export interface PromotionCandidate {
  readonly id: string;
  readonly kind: PromotionKind;
  readonly name: LocalizedText;
  readonly discountType: PromoDiscountType;
  readonly discountPercentageBp: number | null;
  readonly discountAmountCents: number | null;
  readonly fixedPriceCents: number | null;
  readonly priority: number;
  readonly createdAt: Date;
  readonly specificity: PromotionSpecificity;
}

/**
 * `PRODUCT` y `COMBO` comparten el rango más alto a propósito: un Combo no
 * participa de la jerarquía de Category (la relación Combo<->Product es
 * directa, sin Category de por medio — `docs/domain-modules.md` §3.3), así
 * que nunca compiten entre sí por especificidad: para una entidad dada, los
 * candidatos son siempre homogéneos (todos `PRODUCT`/`CATEGORY`, o todos
 * `COMBO`).
 */
const SPECIFICITY_RANK: Readonly<Record<PromotionSpecificity, number>> = {
  PRODUCT: 2,
  COMBO: 2,
  CATEGORY: 1,
};

/**
 * Reglas de resolución de solapamiento, en orden (`features-spec.md` §3.2):
 * 1. Mayor prioridad numérica gana.
 * 2. Empate en prioridad -> gana el alcance más específico (Producto/Combo
 *    dirigido directamente > heredado vía Category).
 * 3. Empate persistente -> gana la promoción creada más recientemente.
 *
 * Se aplica un único ganador (regla 4 del mismo apartado: "el sistema no
 * combina/suma automáticamente" descuentos de dos promociones distintas).
 */
export function pickWinningCandidate(
  candidates: readonly PromotionCandidate[],
): PromotionCandidate | null {
  let winner: PromotionCandidate | null = null;

  for (const candidate of candidates) {
    if (!winner || compareCandidates(candidate, winner) > 0) {
      winner = candidate;
    }
  }

  return winner;
}

function compareCandidates(
  a: PromotionCandidate,
  b: PromotionCandidate,
): number {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  const specificityDiff =
    SPECIFICITY_RANK[a.specificity] - SPECIFICITY_RANK[b.specificity];
  if (specificityDiff !== 0) {
    return specificityDiff;
  }

  return a.createdAt.getTime() - b.createdAt.getTime();
}

/**
 * Etiqueta genérica de UI derivada del `kind`, NO un campo propio de cada
 * Promo/HappyHour (el schema solo modela `name`/`description` por instancia,
 * ver `prisma/schema.prisma`). Coincide con el ejemplo de
 * `docs/api-contracts.md` §3.5. No es contenido editable por Tenant: es una
 * convención fija de la plataforma para que el comensal identifique de un
 * vistazo el motivo del descuento (features-spec.md §3.2, regla 5,
 * "transparencia al comensal").
 */
const BADGE_LABELS: Readonly<Record<PromotionKind, LocalizedText>> = {
  PROMO: { es: 'Promo', en: 'Promo' },
  HAPPY_HOUR: { es: 'Happy Hour', en: 'Happy Hour' },
};

/**
 * Traduce el ganador de `pickWinningCandidate` + el precio base ACTUAL de la
 * entidad concreta al DTO público `ActivePromotionNode`. El cálculo de precio
 * depende del tipo de descuento (`features-spec.md` §3.4):
 * - `PERCENTAGE`: se aplica sobre el precio base actual (nunca uno
 *   "congelado" al momento de crear la Promo) — el descuento sigue vigente
 *   dinámicamente si el precio base cambia después.
 * - `FIXED_AMOUNT`: se resta del precio base actual, sin bajar de 0.
 * - `FIXED_PRICE`: sobrescribe el precio, ignorando el precio base.
 */
export function toActivePromotionNode(
  candidate: PromotionCandidate,
  basePriceCents: number,
): ActivePromotionNode {
  return {
    id: candidate.id,
    kind: candidate.kind,
    name: candidate.name,
    badgeLabel: BADGE_LABELS[candidate.kind],
    discountType: candidate.discountType,
    originalPrice: basePriceCents,
    finalPrice: computeFinalPriceCents(candidate, basePriceCents),
  };
}

function computeFinalPriceCents(
  candidate: PromotionCandidate,
  basePriceCents: number,
): number {
  switch (candidate.discountType) {
    case 'PERCENTAGE': {
      const discountBp = candidate.discountPercentageBp ?? 0;
      return Math.max(
        0,
        Math.round(basePriceCents * (1 - discountBp / 10_000)),
      );
    }
    case 'FIXED_AMOUNT': {
      const discountCents = candidate.discountAmountCents ?? 0;
      return Math.max(0, basePriceCents - discountCents);
    }
    case 'FIXED_PRICE': {
      // `fixedPriceCents` NOT NULL a nivel de negocio para este
      // `discountType` (se valida en el flujo de escritura, fuera de alcance
      // acá); el fallback a `basePriceCents` es defensivo, no un caso
      // esperado en runtime normal.
      return candidate.fixedPriceCents ?? basePriceCents;
    }
  }
}
