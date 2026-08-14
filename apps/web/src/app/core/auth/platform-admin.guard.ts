import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthStore } from './auth.store';

/** UX: `/admin/platform` es solo para `PLATFORM_ADMIN`. La auth real es NestJS. */
export const platformAdminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.currentRoleForActiveBranch() === 'PLATFORM_ADMIN') {
    return true;
  }

  return router.createUrlTree(['/admin']);
};
