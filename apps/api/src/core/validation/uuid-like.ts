/**
 * Forma UUID 8-4-4-4-12 en hex. No exige versión/variante RFC-4122:
 * los IDs de seed son deterministas (`00000000-0000-...`) y no son UUID v4.
 */
export const UUID_LIKE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidLike(value: string): boolean {
  return UUID_LIKE_RE.test(value);
}
