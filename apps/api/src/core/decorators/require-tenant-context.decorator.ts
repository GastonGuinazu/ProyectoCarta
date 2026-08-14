import { SetMetadata } from '@nestjs/common';

export const REQUIRE_TENANT_CONTEXT_KEY = 'requireTenantContext';

/**
 * Exige un `TenantContext` ya resuelto (JWT de tenant, o `X-Tenant-Id` si el
 * caller es `PLATFORM_ADMIN`). Sin él la operación tenant-scoped se rechaza
 * (docs/backend-architecture.md §3.2 — fail-closed).
 */
export const RequireTenantContext = () =>
  SetMetadata(REQUIRE_TENANT_CONTEXT_KEY, true);
