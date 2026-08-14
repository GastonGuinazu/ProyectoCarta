import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantStatus } from '@prisma/client';
import { SKIP_TENANT_RESOLUTION_KEY } from '../decorators/skip-tenant-resolution.decorator';
import {
  TenantOrBranchNotFoundException,
  TenantSuspendedException,
} from '../exceptions/tenant-resolution.exceptions';
import type { TenantScopedRequest } from '../http/tenant-scoped-request';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resuelve el `TenantContext` de la request a partir de los parámetros de ruta
 * `:tenantSlug`/`:branchSlug` (ej. `GET /api/v1/menu/public/:tenantSlug/:branchSlug`)
 * y lo adjunta a `request.tenantContext` (docs/backend-architecture.md §3.3).
 *
 * Usa exclusivamente `PrismaService` (cliente SIN la extensión de aislamiento):
 * resolver el Tenant por `slug` es la única operación legítima que debe poder
 * ocurrir sin un `tenant_id` previo — en este punto del pipeline el contexto
 * todavía no existe, es justamente este Guard quien lo va a crear.
 *
 * Las rutas `/api/v1/admin/**` no resuelven por slug: el `tenantId` sale de
 * los claims JWT (o de `X-Tenant-Id` si impersona `PLATFORM_ADMIN`) vía
 * `TenantContextGuard`, que corre después de `JwtAuthGuard`.
 */
@Injectable()
export class TenantResolutionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_RESOLUTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantScopedRequest>();
    const tenantSlug = this.getStringParam(request.params, 'tenantSlug');
    const branchSlug = this.getStringParam(request.params, 'branchSlug');

    if (!tenantSlug) {
      // Sin slug de tenant en la ruta: no hay nada que este Guard pueda resolver
      // todavía (ver TODO de arriba). Se deja pasar; el fail-closed de la Capa 2
      // sigue protegiendo cualquier acceso real a datos de negocio.
      return true;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new TenantOrBranchNotFoundException();
    }

    if (
      tenant.status === TenantStatus.SUSPENDED ||
      tenant.status === TenantStatus.CANCELLED
    ) {
      throw new TenantSuspendedException();
    }

    let branchId: string | null = null;
    if (branchSlug) {
      const branch = await this.prisma.branch.findUnique({
        where: { tenantId_slug: { tenantId: tenant.id, slug: branchSlug } },
      });
      if (!branch) {
        throw new TenantOrBranchNotFoundException();
      }
      branchId = branch.id;
    }

    request.tenantContext = { tenantId: tenant.id, branchId };
    return true;
  }

  /**
   * Express tipa `req.params[key]` como `string | string[]` (por rutas con
   * comodines). Los slugs de tenant/sucursal nunca deben ser un array: si lo
   * fueran, se trata como parámetro inválido/ausente en lugar de arriesgar un
   * comportamiento ambiguo.
   */
  private getStringParam(
    params: Record<string, string | string[] | undefined> | undefined,
    key: string,
  ): string | undefined {
    const value = params?.[key];
    return typeof value === 'string' ? value : undefined;
  }
}
