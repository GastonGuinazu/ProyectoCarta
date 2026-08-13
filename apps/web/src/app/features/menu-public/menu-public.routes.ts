import { Routes } from '@angular/router';

import { tenantResolver } from '../../core/api/tenant.resolver';

/**
 * Rutas propias de la feature `menu-public` (docs/frontend-architecture.md
 * §4.3 — cada feature expone sus rutas mediante un `*.routes.ts` cargado con
 * `loadChildren` desde `app.routes.ts`).
 *
 * `path: ''`: esta feature es autocontenida bajo el segmento
 * `/m/:tenantSlug/:branchSlug` ya resuelto por el padre (ver `app.routes.ts`).
 * Al ser una ruta "sin path", hereda `tenantSlug`/`branchSlug` del padre por
 * el `paramsInheritanceStrategy` por defecto de Angular (`'emptyOnly'`), así
 * que `tenantResolver` puede leerlos igual desde `route.paramMap`.
 */
export const MENU_PUBLIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./menu-layout.component').then((m) => m.MenuLayoutComponent),
    // No bloqueante (ver tenant.resolver.ts): dispara la resolución y no se
    // espera su valor, por eso el resultado no se consume en ningún lado.
    resolve: { tenantResolution: tenantResolver },
  },
];
