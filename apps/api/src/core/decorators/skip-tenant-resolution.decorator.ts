import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_RESOLUTION_KEY = 'skipTenantResolution';

/**
 * Marca un Controller o handler como exento de la resolución de tenant por slug de
 * ruta (ej. health checks, o futuras rutas admin donde el contexto se resuelva vía
 * JWT en lugar de `:tenantSlug/:branchSlug`).
 *
 * Importante: esto NO desactiva la Capa 2 de aislamiento. Si el handler de todas
 * formas intenta tocar un modelo tenant-scoped sin contexto activo, la extensión de
 * Prisma sigue fallando de forma cerrada (`MissingTenantContextException`).
 */
export const SkipTenantResolution = () =>
  SetMetadata(SKIP_TENANT_RESOLUTION_KEY, true);
