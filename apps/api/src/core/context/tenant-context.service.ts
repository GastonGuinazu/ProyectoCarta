import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { MissingTenantContextException } from '../exceptions/missing-tenant-context.exception';
import type { TenantContext } from './tenant-context.types';

/**
 * Envoltorio de `AsyncLocalStorage` para propagar el `TenantContext` resuelto por el
 * `TenantResolutionGuard` a lo largo de todo el ciclo de vida asíncrono de una request
 * (Controller → Service → Repository → Prisma), sin pasarlo manualmente por cada capa.
 *
 * Ver docs/backend-architecture.md §4.2. Quien abre el contexto es el
 * `TenantContextInterceptor`, vía `run()`; el resto de la aplicación solo lee.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  /**
   * Ejecuta `callback` con `context` activo en el AsyncLocalStorage durante toda su
   * ejecución asíncrona. Debe ser invocado una única vez por request, lo más cerca
   * posible del punto de entrada (ver `TenantContextInterceptor`).
   */
  run<T>(context: TenantContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  /** Devuelve el contexto activo, o `undefined` si no se abrió ninguno. */
  getContext(): TenantContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Devuelve el `tenantId` activo o lanza `MissingTenantContextException` (fail-closed).
   * Es el método que consume la extensión de Prisma (Capa 2 de defensa en profundidad).
   */
  getTenantIdOrThrow(modelName?: string): string {
    const context = this.getContext();
    if (!context) {
      throw new MissingTenantContextException(modelName);
    }
    return context.tenantId;
  }

  /** `branchId` activo, o `null` si no hay contexto o el contexto no tiene sucursal. */
  getBranchId(): string | null {
    return this.getContext()?.branchId ?? null;
  }
}
