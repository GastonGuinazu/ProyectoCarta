import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type {
  BranchInfo,
  TenantBranding,
  TenantFeatureFlags,
  TenantResolutionStatus,
} from '../models/tenant.models';
import { MenuStore } from './menu.store';

/**
 * Mantiene el contexto de Tenant/Sucursal resuelto para la sesión de navegación
 * actual del comensal (docs/frontend-architecture.md §2.3). Espeja el bloque
 * `tenant`/`branch`/`meta.features` de `GET /api/v1/menu/public/...`
 * (docs/api-contracts.md §3.5).
 *
 * Ningún componente escribe directamente sobre estos signals: siempre a través
 * de los métodos públicos de este Store, típicamente invocados desde un futuro
 * `TenantResolverService` (core/services, no forma parte de este ticket).
 */
@Injectable({ providedIn: 'root' })
export class TenantStore {
  private readonly menuStore = inject(MenuStore);

  private readonly _tenant = signal<TenantBranding | null>(null);
  private readonly _branch = signal<BranchInfo | null>(null);
  private readonly _features = signal<TenantFeatureFlags | null>(null);
  private readonly _resolutionStatus = signal<TenantResolutionStatus>('idle');

  readonly tenant = this._tenant.asReadonly();
  readonly branch = this._branch.asReadonly();
  readonly features = this._features.asReadonly();
  readonly resolutionStatus = this._resolutionStatus.asReadonly();

  readonly isResolved = computed(() => this._resolutionStatus() === 'resolved');
  readonly isWebArEnabled = computed(() => this._features()?.webArEnabled ?? false);
  readonly isI18nEnabled = computed(() => this._features()?.i18nEnabled ?? false);

  /** Rastrea la última Sucursal resuelta para detectar cambios reales (ver `effect` abajo). */
  private previousBranchId: string | null = null;

  constructor() {
    // Efecto de sincronización entre Stores (side effect, no derivación pura —
    // por eso `effect()` y no `computed()`): si la Sucursal resuelta cambia
    // respecto a la anterior (ej. el comensal escanea el QR de otro local dentro
    // de la misma sesión de SPA), el menú previamente cacheado en memoria deja de
    // corresponder y se descarta antes de que un futuro `MenuSyncService`
    // hidrate el nuevo (docs/frontend-architecture.md §2.4).
    effect(() => {
      const currentBranchId = this._branch()?.id ?? null;
      if (this.previousBranchId !== null && currentBranchId !== this.previousBranchId) {
        this.menuStore.reset();
      }
      this.previousBranchId = currentBranchId;
    });
  }

  setResolving(): void {
    this._resolutionStatus.set('resolving');
  }

  /**
   * `tenant`/`features` aceptan `null`: el backend actual (`PublicMenuModule`,
   * ver apps/api) todavía solo resuelve datos básicos de Sucursal, no de branding
   * de Tenant ni de flags de plan (`docs/api-contracts.md` §3.5 completo queda
   * pendiente de `CatalogModule`/`EngagementModule`/`MediaModule`). El estado
   * pasa a `resolved` igual, porque la ruta en sí sí se resolvió correctamente
   * (el backend respondió 200): lo que falta es el resto del payload, no la
   * resolución del tenant/sucursal.
   */
  setResolved(data: {
    tenant: TenantBranding | null;
    branch: BranchInfo;
    features: TenantFeatureFlags | null;
  }): void {
    this._tenant.set(data.tenant);
    this._branch.set(data.branch);
    this._features.set(data.features);
    this._resolutionStatus.set('resolved');
  }

  /** Refleja `TENANT_OR_BRANCH_NOT_FOUND` (docs/api-contracts.md §3.7). */
  setNotFound(): void {
    this._resolutionStatus.set('notFound');
    this._tenant.set(null);
    this._branch.set(null);
    this._features.set(null);
  }

  /** Refleja `TENANT_SUSPENDED` (docs/api-contracts.md §3.7). */
  setSuspended(): void {
    this._resolutionStatus.set('suspended');
    this._tenant.set(null);
    this._branch.set(null);
    this._features.set(null);
  }

  /** Cualquier falla que no sea un caso de negocio reconocido (red, 500, timeout, etc.). */
  setError(): void {
    this._resolutionStatus.set('error');
    this._tenant.set(null);
    this._branch.set(null);
    this._features.set(null);
  }

  reset(): void {
    this._tenant.set(null);
    this._branch.set(null);
    this._features.set(null);
    this._resolutionStatus.set('idle');
    this.previousBranchId = null;
  }
}
