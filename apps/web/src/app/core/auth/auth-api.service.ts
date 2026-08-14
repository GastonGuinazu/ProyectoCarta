import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { AdminLoginResponse } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  login(email: string, password: string): Observable<AdminLoginResponse> {
    return this.http.post<AdminLoginResponse>(
      `${environment.apiBaseUrl}/admin/auth/login`,
      { email, password },
      { withCredentials: true },
    );
  }

  refresh(): Observable<AdminLoginResponse> {
    return this.http.post<AdminLoginResponse>(
      `${environment.apiBaseUrl}/admin/auth/refresh`,
      {},
      { withCredentials: true },
    );
  }

  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<void> {
    return this.http.post<void>(
      `${environment.apiBaseUrl}/admin/auth/change-password`,
      { currentPassword, newPassword },
      { withCredentials: true },
    );
  }
}
