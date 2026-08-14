/** Color de respaldo cuando el Tenant no tiene `branding.primaryColor`. */
export const FALLBACK_BRAND_COLOR = '#171717';
export const FALLBACK_BRAND_CONTRAST = '#ffffff';

/**
 * Contraste de texto sobre un hex `#RRGGBB` (luminancia relativa simple).
 * Evita badges ilegibles si el acento del tenant es claro.
 */
export function contrastColorForHex(hex: string): typeof FALLBACK_BRAND_CONTRAST | typeof FALLBACK_BRAND_COLOR {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return FALLBACK_BRAND_CONTRAST;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return FALLBACK_BRAND_CONTRAST;
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? FALLBACK_BRAND_COLOR : FALLBACK_BRAND_CONTRAST;
}
