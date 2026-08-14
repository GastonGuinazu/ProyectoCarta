import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { AnalyticsSummary } from './admin-metrics.models';

@Injectable({ providedIn: 'root' })
export class AdminMetricsApiService {
  private readonly http = inject(HttpClient);

  summary(periodDays: 7 | 30): Observable<AnalyticsSummary> {
    return this.http.get<AnalyticsSummary>(
      `${environment.apiBaseUrl}/admin/analytics/summary`,
      { params: { periodDays } },
    );
  }
}
