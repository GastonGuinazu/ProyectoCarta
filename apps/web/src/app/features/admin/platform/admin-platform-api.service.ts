import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type {
  CreatePlatformTenantPayload,
  PlatformTenantCreated,
  PlatformTenantListItem,
  PlatformTenantStatus,
} from './admin-platform.models';

@Injectable({ providedIn: 'root' })
export class AdminPlatformApiService {
  private readonly http = inject(HttpClient);

  listTenants(): Observable<readonly PlatformTenantListItem[]> {
    return this.http.get<readonly PlatformTenantListItem[]>(
      `${environment.apiBaseUrl}/admin/platform/tenants`,
    );
  }

  createTenant(
    body: CreatePlatformTenantPayload,
  ): Observable<PlatformTenantCreated> {
    return this.http.post<PlatformTenantCreated>(
      `${environment.apiBaseUrl}/admin/platform/tenants`,
      body,
    );
  }

  updateTenantStatus(
    tenantId: string,
    status: PlatformTenantStatus,
  ): Observable<PlatformTenantListItem> {
    return this.http.patch<PlatformTenantListItem>(
      `${environment.apiBaseUrl}/admin/platform/tenants/${tenantId}/status`,
      { status },
    );
  }

  resetOwnerPassword(
    tenantId: string,
    newPassword: string,
  ): Observable<PlatformTenantListItem> {
    return this.http.post<PlatformTenantListItem>(
      `${environment.apiBaseUrl}/admin/platform/tenants/${tenantId}/reset-owner-password`,
      { newPassword },
    );
  }
}
