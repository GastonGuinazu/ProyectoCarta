import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthStore } from './auth.store';

/**
 * Protege el shell de `/admin`. `/admin/login` queda fuera de este guard
 * (docs/frontend-architecture.md §2.7.1). La autorización real es NestJS.
 *
 * Si el JWT no está en memoria (navegación SPA desde el menú público),
 * intenta un silent refresh con la cookie antes de redirigir al login.
 */
export const adminGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    await authStore.refreshToken();
  }

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/admin/login']);
};
