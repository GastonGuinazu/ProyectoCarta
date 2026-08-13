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
