import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthStore } from './auth.store';

function isAdminApiRequest(url: string): boolean {
  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url;
    return path.includes('/api/v1/admin/');
  } catch {
    return url.includes('/api/v1/admin/');
  }
}

function isAuthHandshake(url: string): boolean {
  return url.includes('/admin/auth/login') || url.includes('/admin/auth/refresh');
}

/**
 * Inyecta Bearer + `withCredentials` en `/api/v1/admin/**`.
 * Si el rol efectivo es `PLATFORM_ADMIN`, también manda `X-Tenant-Id`
 * leído del signal `activeAdminTenantId` en el momento de la request.
 * `X-Branch-Id` es la sucursal activa del selector (validada en el backend
 * contra el tenant ya resuelto).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isAdminApiRequest(req.url)) {
    return next(req);
  }

  const authStore = inject(AuthStore);
  const router = inject(Router);
  const accessToken = authStore.accessToken();
  const isHandshake = isAuthHandshake(req.url);

  const headers: Record<string, string> = {};
  if (accessToken && !isHandshake) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (
    !isHandshake &&
    authStore.currentRoleForActiveBranch() === 'PLATFORM_ADMIN'
  ) {
    const impersonatedTenantId = authStore.activeAdminTenantId();
    if (impersonatedTenantId) {
      headers['X-Tenant-Id'] = impersonatedTenantId;
    }
  }

  const activeBranchId = authStore.activeBranchId();
  if (!isHandshake && activeBranchId) {
    headers['X-Branch-Id'] = activeBranchId;
  }

  let adminReq = req.clone({ withCredentials: true });
  if (Object.keys(headers).length > 0) {
    adminReq = adminReq.clone({ setHeaders: headers });
  }

  return next(adminReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isHandshake
      ) {
        authStore.clearSession();
        void router.navigateByUrl('/admin/login');
      }
      return throwError(() => error);
    }),
  );
};
