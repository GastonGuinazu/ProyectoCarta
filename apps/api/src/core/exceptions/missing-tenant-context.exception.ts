import { InternalServerErrorException } from '@nestjs/common';

/**
 * Se lanza cuando código de aplicación intenta operar sobre un modelo Prisma
 * "tenant-scoped" sin un `TenantContext` activo en el `AsyncLocalStorage`
 * (docs/backend-architecture.md §4.2, Paso 3 — comportamiento fail-closed).
 *
 * Esto nunca debería ocurrir en una request HTTP correctamente resuelta por el
 * `TenantResolutionGuard` + `TenantContextInterceptor`. Si aparece, indica un bug
 * (ej. un job en background sin contexto propio, o una ruta que debería declarar
 * `@SkipTenantResolution()` pero de todas formas accede a datos de negocio).
 */
export class MissingTenantContextException extends InternalServerErrorException {
  constructor(modelName?: string) {
    super({
      code: 'MISSING_TENANT_CONTEXT',
      message: modelName
        ? `Intento de acceder al modelo "${modelName}" sin un contexto de tenant activo.`
        : 'No hay un contexto de tenant activo para esta operación.',
    });
  }
}
