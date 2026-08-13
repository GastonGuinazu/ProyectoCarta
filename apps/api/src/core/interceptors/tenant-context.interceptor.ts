import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from '../context/tenant-context.service';
import type { TenantScopedRequest } from '../http/tenant-scoped-request';

/**
 * Propaga el `TenantContext` (ya adjuntado a `request.tenantContext` por el
 * `TenantResolutionGuard`) al `AsyncLocalStorage` gestionado por
 * `TenantContextService`, envolviendo el resto del pipeline (Pipes → Controller →
 * Service → Repository → Prisma) dentro de ese contexto
 * (docs/backend-architecture.md §3.1/§4.2, Paso 1).
 *
 * Se registra como Interceptor global (no como parte del Guard) porque solo un
 * Interceptor puede envolver la continuación asíncrona de la request vía
 * `next.handle()`; un Guard únicamente puede aceptar/rechazar la request.
 *
 * Si la request no tiene `tenantContext` (rutas con `@SkipTenantResolution()`, o
 * sin slug resuelto todavía — ver TODO en `TenantResolutionGuard`), se deja pasar
 * sin abrir contexto: cualquier acceso a un modelo tenant-scoped fallará de forma
 * cerrada en la extensión de Prisma.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<TenantScopedRequest>();
    const tenantContext = request.tenantContext;

    if (!tenantContext) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.tenantContextService.run(tenantContext, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
