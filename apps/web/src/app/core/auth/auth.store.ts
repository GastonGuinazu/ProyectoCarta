import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { extractApiErrorCode } from '../../utils/api-error.utils';
import { environment } from '../../../environments/environment';
import { AuthApiService } from './auth-api.service';
import type {
  AccessibleBranch,
  AdminLoginResponse,
  AdminTenantSummary,
  AdminUser,
  JwtRoleAssignment,
} from './auth.models';

/**
 * Estado de sesión del Panel Admin (docs/frontend-architecture.md §2.7).
 * El `accessToken` vive **solo en memoria** — nunca en `localStorage`.
 * El refresh queda en cookie HttpOnly que setea el backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authApi = inject(AuthApiService);

  private readonly _accessToken = signal<string | null>(null);
  private readonly _currentUser = signal<AdminUser | null>(null);
  private readonly _tenant = signal<AdminTenantSummary | null>(null);
  private readonly _roleAssignments = signal<readonly JwtRoleAssignment[]>([]);
  private readonly _accessibleBranches = signal<readonly AccessibleBranch[]>([]);
  private readonly _activeBranchId = signal<string | null>(null);
  private readonly _activeAdminTenantId = signal<string | null>(
    environment.platformImpersonationTenantId,
  );
  private readonly _pending = signal(false);
  private readonly _loginError = signal<string | null>(null);
  private restorePromise: Promise<void> | null = null;

  readonly accessToken = this._accessToken.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly tenant = this._tenant.asReadonly();
  readonly roleAssignments = this._roleAssignments.asReadonly();
  readonly accessibleBranches = this._accessibleBranches.asReadonly();
  readonly activeBranchId = this._activeBranchId.asReadonly();
  readonly activeAdminTenantId = this._activeAdminTenantId.asReadonly();
  readonly pending = this._pending.asReadonly();
  readonly loginError = this._loginError.asReadonly();

  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  readonly currentRoleForActiveBranch = computed(() => {
    const assignments = this._roleAssignments();
    if (assignments.some((assignment) => assignment.role === 'PLATFORM_ADMIN')) {
      return 'PLATFORM_ADMIN' as const;
    }

    const branchId = this._activeBranchId();
    const applicable = assignments.filter(
      (assignment) =>
        assignment.scope === 'TENANT' || assignment.branchId === branchId,
    );
    const rank = { STAFF: 1, ADMIN: 2, OWNER: 3, PLATFORM_ADMIN: 4 } as const;
    let best: JwtRoleAssignment['role'] | null = null;
    for (const assignment of applicable) {
      if (!best || rank[assignment.role] > rank[best]) {
        best = assignment.role;
      }
    }
    return best;
  });

  async login(email: string, password: string): Promise<void> {
    this._pending.set(true);
    this._loginError.set(null);

    try {
      const session = await firstValueFrom(this.authApi.login(email, password));
      this.applySession(session);
    } catch (error: unknown) {
      this.clearSession();
      this._loginError.set(this.messageForLoginError(error));
      throw error;
    } finally {
      this._pending.set(false);
    }
  }

  logout(): void {
    this.clearSession();
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await firstValueFrom(
      this.authApi.changePassword(currentPassword, newPassword),
    );
  }

  /**
   * Silent refresh: el navegador manda la cookie HttpOnly.
   * Si no hay cookie o está vencida, deja el store limpio y no relanza.
   */
  async refreshToken(): Promise<void> {
    if (this._accessToken()) {
      return;
    }
    if (this.restorePromise) {
      return this.restorePromise;
    }

    this.restorePromise = this.restoreFromCookie();
    try {
      await this.restorePromise;
    } finally {
      this.restorePromise = null;
    }
  }

  setActiveBranch(branchId: string): void {
    if (!this._accessibleBranches().some((branch) => branch.id === branchId)) {
      return;
    }
    this._activeBranchId.set(branchId);
    this.persistActiveBranchId(branchId);
  }

  upsertAccessibleBranch(branch: AccessibleBranch): void {
    const current = this._accessibleBranches();
    if (current.some((item) => item.id === branch.id)) {
      this._accessibleBranches.set(
        current.map((item) => (item.id === branch.id ? branch : item)),
      );
      return;
    }
    this._accessibleBranches.set([...current, branch]);
  }

  replaceAccessibleBranches(branches: readonly AccessibleBranch[]): void {
    this._accessibleBranches.set(branches);
    const activeId = this._activeBranchId();
    if (activeId && branches.some((branch) => branch.id === activeId)) {
      return;
    }
    const nextId = this.resolveInitialBranchId(branches);
    this._activeBranchId.set(nextId);
    this.persistActiveBranchId(nextId);
  }

  clearSession(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
    this._tenant.set(null);
    this._roleAssignments.set([]);
    this._accessibleBranches.set([]);
    this._activeBranchId.set(null);
    this._activeAdminTenantId.set(environment.platformImpersonationTenantId);
  }

  private async restoreFromCookie(): Promise<void> {
    try {
      const session = await firstValueFrom(this.authApi.refresh());
      this.applySession(session);
    } catch {
      this.clearSession();
    }
  }

  private applySession(session: AdminLoginResponse): void {
    this._accessToken.set(session.accessToken);
    this._currentUser.set(session.user);
    this._tenant.set(session.tenant);
    this._roleAssignments.set(session.roleAssignments);
    this._accessibleBranches.set(session.accessibleBranches);

    const isPlatformAdmin = session.roleAssignments.some(
      (assignment) => assignment.role === 'PLATFORM_ADMIN',
    );
    this._activeAdminTenantId.set(
      isPlatformAdmin ? environment.platformImpersonationTenantId : null,
    );
    this._activeBranchId.set(
      this.resolveInitialBranchId(session.accessibleBranches),
    );
  }

  private resolveInitialBranchId(
    branches: readonly AccessibleBranch[],
  ): string | null {
    const stored = this.readStoredBranchId();
    if (stored && branches.some((branch) => branch.id === stored)) {
      return stored;
    }
    const firstId = branches[0]?.id ?? null;
    this.persistActiveBranchId(firstId);
    return firstId;
  }

  private storageKey(): string | null {
    const tenantId = this._tenant()?.id ?? this._activeAdminTenantId();
    if (!tenantId) {
      return null;
    }
    return `pc.admin.activeBranch.${tenantId}`;
  }

  private readStoredBranchId(): string | null {
    const key = this.storageKey();
    if (!key || typeof sessionStorage === 'undefined') {
      return null;
    }
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private persistActiveBranchId(branchId: string | null): void {
    const key = this.storageKey();
    if (!key || typeof sessionStorage === 'undefined') {
      return;
    }
    try {
      if (branchId) {
        sessionStorage.setItem(key, branchId);
      } else {
        sessionStorage.removeItem(key);
      }
    } catch {
      return;
    }
  }

  private messageForLoginError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No pudimos iniciar sesión. Intentá de nuevo.';
    }

    if (error.status === 0) {
      return 'No pudimos conectar con el servidor. Revisá que la API esté en marcha.';
    }

    const code = extractApiErrorCode(error.error);
    switch (code) {
      case 'INVALID_CREDENTIALS':
        return 'Email o contraseña incorrectos.';
      case 'ACCOUNT_DISABLED':
        return 'Esta cuenta no está activa.';
      case 'TENANT_SUSPENDED':
        return 'Este local está temporalmente inactivo.';
      case 'RATE_LIMIT_EXCEEDED':
        return 'Demasiados intentos. Esperá un momento y volvé a probar.';
      default:
        return 'No pudimos iniciar sesión. Intentá de nuevo.';
    }
  }
}
