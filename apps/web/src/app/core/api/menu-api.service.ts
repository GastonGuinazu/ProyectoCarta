import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { PublicMenuApiResponse } from '../models/public-menu-response.model';

/**
 * Capa de acceso HTTP al `PublicMenuModule` de `apps/api`
 * (docs/api-contracts.md §3.5, docs/frontend-architecture.md §4.2).
 *
 * `providedIn: 'root'`: singleton de app, sin estado propio — solo compone
 * requests. `HttpClient` inyectado con `inject()`, sin `HttpClientModule`
 * (provisto vía `provideHttpClient()` en `app.config.ts`).
 */
@Injectable({ providedIn: 'root' })
export class MenuApiService {
  private readonly http = inject(HttpClient);

  /**
   * `GET /api/v1/menu/public/:tenantSlug/:branchSlug`.
   *
   * El tipo de retorno (`PublicMenuApiResponse`) refleja la forma "wire" real
   * que devuelve hoy el backend (`branch`, `categories`, `combos`, `catalogs`)
   * — ver `public-menu-response.model.ts`. Sigue sin incluir `meta` ni
   * `tenant.branding`, pendientes de `MediaModule`.
   */
  fetchPublicMenu(tenantSlug: string, branchSlug: string): Observable<PublicMenuApiResponse> {
    const url = `${environment.apiBaseUrl}/menu/public/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(branchSlug)}`;
    return this.http.get<PublicMenuApiResponse>(url);
  }
}
