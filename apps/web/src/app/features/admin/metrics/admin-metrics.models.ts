export interface AnalyticsNamedCount {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

export interface AnalyticsSearchCount {
  readonly query: string;
  readonly count: number;
}

export interface AnalyticsSummary {
  readonly periodDays: number;
  readonly branchId: string;
  readonly visits: number;
  readonly stayedCount: number;
  readonly averageDwellSeconds: number | null;
  readonly searches: readonly AnalyticsSearchCount[];
  readonly allergenFilters: readonly AnalyticsNamedCount[];
  readonly dietaryFilters: readonly AnalyticsNamedCount[];
  readonly arViews: {
    readonly total: number;
    readonly products: readonly AnalyticsNamedCount[];
  };
}
