import { inject, provideAppInitializer } from '@angular/core';

import { AuthStore } from './auth.store';

/**
 * Rehidrata el JWT en memoria antes del primer navigation.
 * Solo corre en `/admin/**`: el menú público no espera a un 401 de refresh.
 */
export function provideAuthSessionRestore() {
  return provideAppInitializer(() => {
    const authStore = inject(AuthStore);
    const pathname = globalThis.location?.pathname ?? '';
    if (!pathname.startsWith('/admin')) {
      return;
    }
    return authStore.refreshToken();
  });
}
