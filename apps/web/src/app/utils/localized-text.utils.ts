import type { LocalizedText } from '../core/models/menu.models';

/**
 * Función pura, sin `inject()` (docs/frontend-architecture.md §4.2 — capa
 * `utils/` no puede depender de ninguna otra capa). Resuelve un
 * `LocalizedText` (`{ "<códigoIdioma>": "<valor>" }`) a un `string` mostrable.
 *
 * `PreferencesStore.selectedLanguage` (docs/frontend-architecture.md §4.1,
 * tabla de `resolvedProductLabel`) todavía no existe como Store — por eso el
 * idioma preferido se recibe como parámetro en vez de inyectarse, y por
 * defecto cae en `'es'`. Cuando `PreferencesStore` se implemente, quien llame
 * a esta función (un componente o un futuro `computed()`) le pasará
 * `preferencesStore.selectedLanguage()` en vez de depender del default.
 */
export function pickLocalizedText(text: LocalizedText, preferredLocale = 'es'): string {
  if (text[preferredLocale]) {
    return text[preferredLocale];
  }

  if (text['es']) {
    return text['es'];
  }

  const firstAvailable = Object.values(text)[0];
  return firstAvailable ?? '';
}

/**
 * Coincide contra cualquier traducción del `LocalizedText` (el comensal puede
 * buscar en el idioma visible o en otro publicado). Cadena vacía = match.
 */
export function localizedTextMatches(
  text: LocalizedText | null | undefined,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  if (!text) {
    return false;
  }
  return Object.values(text).some((value) => value.toLowerCase().includes(needle));
}

/**
 * Actualiza (o crea) la clave de idioma en un `LocalizedText`. Si no hay valor
 * en `es` (idioma por defecto del tenant en este producto), lo rellena para
 * satisfacer la validación del backend.
 */
export function upsertLocalizedText(
  existing: LocalizedText | null | undefined,
  language: string,
  value: string,
): LocalizedText {
  const trimmed = value.trim();
  const next: LocalizedText = { ...(existing ?? {}) };
  next[language] = trimmed;
  if (!next['es']) {
    next['es'] = trimmed;
  }
  return next;
}
