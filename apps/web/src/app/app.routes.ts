import { Routes } from '@angular/router';

/**
 * Enrutamiento raíz (docs/frontend-architecture.md §4.1). La ruta pública del
 * menú delega por completo en la feature `menu-public` vía `loadChildren`
 * (docs/frontend-architecture.md §4.3 — cada feature es autocontenida y
 * expone sus propias rutas), manteniendo el bundle inicial mínimo
 * (.cursor/rules/02-frontend-angular.mdc — lazy loading por defecto).
 */
export const routes: Routes = [
  {
    path: 'm/:tenantSlug/:branchSlug',
    loadChildren: () =>
      import('./features/menu-public/menu-public.routes').then((m) => m.MENU_PUBLIC_ROUTES),
  },
];
