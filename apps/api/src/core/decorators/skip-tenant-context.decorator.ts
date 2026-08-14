import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_CONTEXT_KEY = 'skipTenantContext';

/**
 * La operación es del usuario autenticado, no del Tenant impersonado.
 * `TenantContextGuard` valida JWT pero no resuelve ni exige tenant
 * (cambio de contraseña: un PLATFORM_ADMIN no debe fallar si `X-Tenant-Id`
 * apunta a una cuenta suspendida).
 */
export const SkipTenantContext = () =>
  SetMetadata(SKIP_TENANT_CONTEXT_KEY, true);
