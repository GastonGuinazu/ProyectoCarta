/**
 * Función pura, sin `inject()` (docs/frontend-architecture.md §4.1 —
 * "formateo de precios desde centavos" es explícitamente responsabilidad de
 * `utils/`). Todos los precios viajan en centavos (`basePrice`, `price`,
 * `originalPrice`, `finalPrice` de `menu.models.ts`) para evitar errores de
 * redondeo con `float`; esta función es el único lugar que los convierte a
 * una representación monetaria legible.
 */
export function formatPriceFromCents(cents: number, currency: string, locale = 'es-AR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
