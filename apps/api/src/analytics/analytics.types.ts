export const STAYED_THRESHOLD_MS = 30_000;
export const SEARCH_DEDUPE_MS = 20_000;
export const FILTER_DEDUPE_MS = 10_000;
export const AR_DEDUPE_MS = 10_000;
export const MAX_SEARCH_QUERY_LENGTH = 80;
export const MAX_DWELL_MS = 24 * 60 * 60 * 1000;

export type PublicEventKind =
  | 'scan'
  | 'search'
  | 'filter'
  | 'ar'
  | 'dwell';

export type PublicFilterKind = 'allergen' | 'dietary';

export interface RecordPublicEventInput {
  readonly kind: PublicEventKind;
  readonly sessionId: string;
  readonly query?: string;
  readonly filterKind?: PublicFilterKind;
  readonly tagId?: string;
  readonly productId?: string;
  readonly durationMs?: number;
  readonly userAgent?: string | null;
}

export interface AnalyticsSummary {
  readonly periodDays: number;
  readonly branchId: string;
  readonly visits: number;
  readonly stayedCount: number;
  readonly averageDwellSeconds: number | null;
  readonly searches: readonly { readonly query: string; readonly count: number }[];
  readonly allergenFilters: readonly {
    readonly id: string;
    readonly name: string;
    readonly count: number;
  }[];
  readonly dietaryFilters: readonly {
    readonly id: string;
    readonly name: string;
    readonly count: number;
  }[];
  readonly arViews: {
    readonly total: number;
    readonly products: readonly {
      readonly id: string;
      readonly name: string;
      readonly count: number;
    }[];
  };
}
