import { Routes } from '@angular/router';

import { adminGuard } from '../../core/auth/admin.guard';
import { platformAdminGuard } from '../../core/auth/platform-admin.guard';

/**
 * Rutas del Panel Admin (docs/frontend-architecture.md §2.7.1 / §4.3).
 * `/admin/login` es pública; el resto del árbol exige sesión en memoria.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./admin-home.component').then((m) => m.AdminHomeComponent),
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./account.component').then((m) => m.AccountComponent),
      },
      {
        path: 'platform',
        canActivate: [platformAdminGuard],
        loadComponent: () =>
          import('./platform/platform-tenants.component').then(
            (m) => m.PlatformTenantsComponent,
          ),
      },
      {
        path: 'catalog',
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./catalog/product-list.component').then(
                (m) => m.ProductListComponent,
              ),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./catalog/product-form.component').then(
                (m) => m.ProductFormComponent,
              ),
          },
          {
            path: 'categories',
            loadComponent: () =>
              import('./catalog/category-list.component').then(
                (m) => m.CategoryListComponent,
              ),
          },
          {
            path: 'combos',
            children: [
              {
                path: '',
                pathMatch: 'full',
                loadComponent: () =>
                  import('./catalog/combo-list.component').then(
                    (m) => m.ComboListComponent,
                  ),
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('./catalog/combo-form.component').then(
                    (m) => m.ComboFormComponent,
                  ),
              },
              {
                path: ':id/edit',
                loadComponent: () =>
                  import('./catalog/combo-form.component').then(
                    (m) => m.ComboFormComponent,
                  ),
              },
            ],
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./catalog/product-form.component').then(
                (m) => m.ProductFormComponent,
              ),
          },
        ],
      },
      {
        path: 'promos',
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./promos/offer-list.component').then(
                (m) => m.OfferListComponent,
              ),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./promos/promo-form.component').then(
                (m) => m.PromoFormComponent,
              ),
          },
          {
            path: 'happy-hours/new',
            loadComponent: () =>
              import('./promos/happy-hour-form.component').then(
                (m) => m.HappyHourFormComponent,
              ),
          },
          {
            path: 'happy-hours/:id/edit',
            loadComponent: () =>
              import('./promos/happy-hour-form.component').then(
                (m) => m.HappyHourFormComponent,
              ),
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./promos/promo-form.component').then(
                (m) => m.PromoFormComponent,
              ),
          },
        ],
      },
      {
        path: 'branches',
        loadComponent: () =>
          import('./branches/branch-list.component').then(
            (m) => m.BranchListComponent,
          ),
      },
      {
        path: 'metrics',
        loadComponent: () =>
          import('./metrics/admin-metrics.component').then(
            (m) => m.AdminMetricsComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
];
