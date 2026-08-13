import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TenantContext } from '../context/tenant-context.types';
import type { TenantScopedRequest } from '../http/tenant-scoped-request';

/**
 * Inyecta el `TenantContext` ya resuelto por el `TenantResolutionGuard` en un
 * parámetro de Controller, evitando leer `request.tenantContext` a mano
 * (docs/backend-architecture.md §3.3). Devuelve `undefined` en rutas marcadas con
 * `@SkipTenantResolution()` que nunca resolvieron contexto.
 */
export const CurrentTenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantContext | undefined => {
    const request = ctx.switchToHttp().getRequest<TenantScopedRequest>();
    return request.tenantContext;
  },
);
