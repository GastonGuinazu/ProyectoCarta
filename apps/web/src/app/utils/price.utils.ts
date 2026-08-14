/**
 * Funciones puras, sin `inject()` (docs/frontend-architecture.md §4.1 —
 * "formateo de precios desde centavos" es explícitamente responsabilidad de
 * `utils/`). Todos los precios viajan en centavos (`basePrice`, `price`,
 * `originalPrice`, `finalPrice` de `menu.models.ts`) para evitar errores de
 * redondeo con `float`.
 */

/** Convierte unidades mayores (pesos) a centavos enteros para el backend. */
export function majorUnitsToCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Convierte centavos del backend a unidades mayores para inputs numéricos. */
export function centsToMajorUnits(cents: number): number {
  return cents / 100;
}

export function formatPriceFromCents(cents: number, currency: string, locale = 'es-AR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
