/**
 * Contexto de Tenant resuelto por el `TenantResolutionGuard` y propagado a lo largo
 * de todo el ciclo de vida de la request (docs/backend-architecture.md §3.3/§4.2).
 *
 * `branchId` es `null` cuando la request solo resolvió Tenant (ej. rutas de alcance
 * de tenant sin sucursal en la URL), nunca `undefined` una vez que el contexto existe.
 */
export interface TenantContext {
  readonly tenantId: string;
  readonly branchId: string | null;
}
