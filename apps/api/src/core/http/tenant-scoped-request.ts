import type { Request } from 'express';
import type { TenantContext } from '../context/tenant-context.types';

/**
 * Forma explícita en la que el `TenantResolutionGuard` adjunta el `TenantContext`
 * resuelto a la request (docs/backend-architecture.md §3.3, punto "Explícita").
 */
export interface TenantScopedRequest extends Request {
  tenantContext?: TenantContext;
}
