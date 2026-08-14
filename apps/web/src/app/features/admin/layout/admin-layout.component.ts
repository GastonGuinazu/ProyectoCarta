import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { AdminBranchApiService } from '../branches/admin-branch-api.service';

interface AdminNavItem {
  readonly label: string;
  readonly path: string;
}

const PLATFORM_NAV: readonly AdminNavItem[] = [
  { label: 'Gestión Global', path: '/admin/platform' },
];

const TENANT_NAV: readonly AdminNavItem[] = [
  { label: 'Catálogo', path: '/admin/catalog' },
  { label: 'Promos', path: '/admin/promos' },
  { label: 'Sucursales', path: '/admin/branches' },
  { label: 'Métricas', path: '/admin/metrics' },
  { label: 'Configuración', path: '/admin/settings' },
];

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly branchApi = inject(AdminBranchApiService);

  protected readonly platformNav = PLATFORM_NAV;
  protected readonly tenantNav = TENANT_NAV;
  protected readonly isSidebarOpen = signal(false);
  protected readonly accessibleBranches = this.authStore.accessibleBranches;
  protected readonly activeBranchId = this.authStore.activeBranchId;

  ngOnInit(): void {
    if (this.isPlatformAdmin() && this.authStore.activeAdminTenantId()) {
      void this.hydrateImpersonatedBranches();
    }
  }

  protected onBranchChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value) {
      this.authStore.setActiveBranch(value);
    }
  }

  protected readonly isPlatformAdmin = computed(
    () => this.authStore.currentRoleForActiveBranch() === 'PLATFORM_ADMIN',
  );

  protected readonly canManageTenant = computed(() => {
    const role = this.authStore.currentRoleForActiveBranch();
    return (
      role === 'OWNER' ||
      role === 'ADMIN' ||
      role === 'PLATFORM_ADMIN'
    );
  });

  protected readonly showBranchSelector = computed(
    () => this.accessibleBranches().length > 1,
  );

  protected readonly publicMenuUrl = computed(() => {
    const tenantSlug = this.authStore.tenant()?.slug;
    const branchId = this.authStore.activeBranchId();
    const branch = this.authStore
      .accessibleBranches()
      .find((item) => item.id === branchId);
    if (!tenantSlug || !branch) {
      return null;
    }
    return `/m/${tenantSlug}/${branch.slug}`;
  });

  protected readonly contextLabel = computed(() => {
    if (this.isPlatformAdmin()) {
      return 'Panel Global';
    }

    const branchId = this.authStore.activeBranchId();
    const branch = this.authStore
      .accessibleBranches()
      .find((item) => item.id === branchId);

    return branch?.name ?? this.authStore.tenant()?.name ?? 'Panel';
  });

  protected toggleSidebar(): void {
    this.isSidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  protected logout(): void {
    this.closeSidebar();
    this.authStore.logout();
    void this.router.navigateByUrl('/admin/login');
  }

  private async hydrateImpersonatedBranches(): Promise<void> {
    try {
      const result = await firstValueFrom(this.branchApi.list());
      this.authStore.replaceAccessibleBranches(
        result.branches.map((branch) => ({
          id: branch.id,
          slug: branch.slug,
          name: branch.name,
        })),
      );
    } catch {
      return;
    }
  }
}
