import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { TenantStore } from '../../core/stores/tenant.store';
import { CategoryListComponent } from './category-list.component';

/** Color de respaldo cuando el Tenant todavía no resolvió `branding.primaryColor` (backend pendiente, ver `TenantStore`). */
const FALLBACK_BRAND_COLOR = '#171717';

/**
 * Contenedor principal de la feature (docs/frontend-architecture.md §4.1).
 * Único componente que lee `TenantStore.resolutionStatus()` para decidir
 * entre pantalla de carga, pantalla de error y el menú real — evita repetir
 * esa lógica en cada componente hijo.
 */
@Component({
  selector: 'app-menu-layout',
  standalone: true,
  imports: [NgOptimizedImage, CategoryListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-layout.component.html',
})
export class MenuLayoutComponent {
  protected readonly tenantStore = inject(TenantStore);

  protected readonly resolutionStatus = this.tenantStore.resolutionStatus;

  protected readonly brandColor = computed(
    () => this.tenantStore.tenant()?.primaryColor ?? FALLBACK_BRAND_COLOR,
  );

  protected readonly logoUrl = computed(() => this.tenantStore.tenant()?.logoUrl ?? null);

  /** Título del header: nombre del Tenant si ya está resuelto, si no el de la Sucursal (siempre disponible). */
  protected readonly headerTitle = computed(
    () => this.tenantStore.tenant()?.name ?? this.tenantStore.branch()?.name ?? '',
  );

  protected readonly branchName = computed(() => this.tenantStore.branch()?.name ?? '');

  protected reload(): void {
    window.location.reload();
  }
}
