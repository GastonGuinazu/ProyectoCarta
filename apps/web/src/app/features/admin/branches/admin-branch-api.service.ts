import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type {
  AdminBranchList,
  AdminBranchListItem,
  CreateAdminBranchPayload,
  UpdateAdminBranchPayload,
} from './admin-branch.models';

@Injectable({ providedIn: 'root' })
export class AdminBranchApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<AdminBranchList> {
    return this.http.get<AdminBranchList>(`${environment.apiBaseUrl}/admin/branches`);
  }

  create(body: CreateAdminBranchPayload): Observable<AdminBranchListItem> {
    return this.http.post<AdminBranchListItem>(
      `${environment.apiBaseUrl}/admin/branches`,
      body,
    );
  }

  update(
    branchId: string,
    body: UpdateAdminBranchPayload,
  ): Observable<AdminBranchListItem> {
    return this.http.patch<AdminBranchListItem>(
      `${environment.apiBaseUrl}/admin/branches/${branchId}`,
      body,
    );
  }
}
