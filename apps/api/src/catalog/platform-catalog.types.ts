import type { LocalizedText } from '../core';

/**
 * Filas crudas de los catálogos globales de plataforma (`Allergen`,
 * `DietaryTag` — features-spec.md §5.1-5.2). No tienen `tenantId`: son la
 * misma lista para todos los Tenants.
 */
export interface AllergenRow {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly iconUrl: string | null;
}

export interface DietaryTagRow {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly iconUrl: string | null;
}
