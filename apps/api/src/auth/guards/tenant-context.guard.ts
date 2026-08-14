import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType, TenantStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../../core';
import { REQUIRE_TENANT_CONTEXT_KEY } from '../../core/decorators/require-tenant-context.decorator';
import { SKIP_TENANT_CONTEXT_KEY } from '../../core/decorators/skip-tenant-context.decorator';
import { TenantOrBranchNotFoundException } from '../../core/exceptions/tenant-resolution.exceptions';
import { PrismaService } from '../../core/prisma/prisma.service';
import { isUuidLike } from '../../core/validation/uuid-like';
import type { AuthenticatedRequest } from '../authenticated-request';
import type { AuthenticatedUser, JwtRoleClaim } from '../auth.types';
import { AuthTenantSuspendedException } from '../exceptions/auth.exceptions';

const IMPERSONATION_HEADER = 'x-tenant-id';

/**
 * Resuelve `TenantContext` en rutas admin autenticadas
 * (docs/backend-architecture.md §3.2–3.3). Nunca lee `tenantId` del body
 * ni de params: OWNER/ADMIN/STAFF → claim JWT; PLATFORM_ADMIN → solo
 * `X-Tenant-Id` (cualquier otro rol que mande ese header: se ignora).
 * `X-Branch-Id` (opcional) es la sucursal del selector del panel: debe
 * pertenecer al tenant ya resuelto y estar cubierta por el alcance del rol.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      return false;
    }

    const skipTenantContext = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipTenantContext) {
      return true;
    }

    const tenantId = this.resolveTenantId(request, user);
    if (tenantId) {
      await this.attachTenantContext(request, user, tenantId);
    }

    const requiresTenant = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_TENANT_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiresTenant && !request.tenantContext) {
      throw new ForbiddenException({
        code: 'TENANT_CONTEXT_REQUIRED',
        message:
          'Esta operación requiere un tenant. Si sos operador de plataforma, enviá el header X-Tenant-Id.',
      });
    }

    return true;
  }

  private resolveTenantId(
    request: AuthenticatedRequest,
    user: AuthenticatedUser,
  ): string | null {
    if (this.isPlatformAdmin(user.roles)) {
      return this.readImpersonationHeader(request);
    }
    return user.tenantId;
  }

  private isPlatformAdmin(roles: readonly JwtRoleClaim[]): boolean {
    return roles.some((assignment) => assignment.role === RoleType.PLATFORM_ADMIN);
  }

  private readImpersonationHeader(request: AuthenticatedRequest): string | null {
    const raw = request.headers[IMPERSONATION_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async attachTenantContext(
    request: AuthenticatedRequest,
    user: AuthenticatedUser,
    tenantId: string,
  ): Promise<void> {
    if (!isUuidLike(tenantId)) {
      throw new TenantOrBranchNotFoundException();
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });
    if (!tenant) {
      throw new TenantOrBranchNotFoundException();
    }
    if (
      tenant.status === TenantStatus.SUSPENDED ||
      tenant.status === TenantStatus.CANCELLED
    ) {
      throw new AuthTenantSuspendedException();
    }

    request.tenantContext = {
      tenantId: tenant.id,
      branchId: await this.resolveBranchId(request, user, tenant.id),
    };
  }

  private async resolveBranchId(
    request: AuthenticatedRequest,
    user: AuthenticatedUser,
    tenantId: string,
  ): Promise<string | null> {
    const raw = request.headers['x-branch-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') {
      return null;
    }
    const branchId = value.trim();
    if (branchId.length === 0) {
      return null;
    }
    if (!isUuidLike(branchId)) {
      throw new TenantOrBranchNotFoundException();
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch || !this.userCanAccessBranch(user, branch.id)) {
      throw new TenantOrBranchNotFoundException();
    }
    return branch.id;
  }

  private userCanAccessBranch(
    user: AuthenticatedUser,
    branchId: string,
  ): boolean {
    if (this.isPlatformAdmin(user.roles)) {
      return true;
    }
    return user.roles.some(
      (assignment) =>
        assignment.scope === 'TENANT' ||
        (assignment.scope === 'BRANCH' && assignment.branchId === branchId),
    );
  }
}
