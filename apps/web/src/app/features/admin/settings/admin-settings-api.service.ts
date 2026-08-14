import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type {
  AdminBranchSettings,
  AdminBranchSettingsWritePayload,
  AdminBrandingSlot,
  AdminBrandingUploadResponse,
} from './admin-settings.models';

@Injectable({ providedIn: 'root' })
export class AdminSettingsApiService {
  private readonly http = inject(HttpClient);

  getBranchSettings(): Observable<AdminBranchSettings> {
    return this.http.get<AdminBranchSettings>(
      `${environment.apiBaseUrl}/admin/settings/branch`,
    );
  }

  updateBranchSettings(
    body: AdminBranchSettingsWritePayload,
  ): Observable<AdminBranchSettings> {
    return this.http.patch<AdminBranchSettings>(
      `${environment.apiBaseUrl}/admin/settings/branch`,
      body,
    );
  }

  uploadBranding(
    slot: AdminBrandingSlot,
    file: File,
  ): Observable<AdminBrandingUploadResponse> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<AdminBrandingUploadResponse>(
      `${environment.apiBaseUrl}/admin/settings/branch/${slot}`,
      body,
    );
  }

  deleteBranding(slot: AdminBrandingSlot): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/admin/settings/branch/${slot}`,
    );
  }
}
