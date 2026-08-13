/**
 * Campo traducible (`Json` en Prisma) — `{ "es": "...", "en": "..." }`
 * (features-spec.md §6, ver convención documentada al inicio de
 * prisma/schema.prisma). Se castea desde `Prisma.JsonValue` en los
 * Repositories porque el propio backend controla la forma en la que se
 * escribió ese `Json` (nunca se recibe este tipo directo desde afuera sin
 * pasar por un DTO validado en el flujo de escritura correspondiente).
 */
export type LocalizedText = Record<string, string>;
