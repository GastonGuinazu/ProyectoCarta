import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';

import { TenantResolverService } from './tenant-resolver.service';

/**
 * Resolver funcional de Router para la ruta pública del menú
 * (`/m/:tenantSlug/:branchSlug`, ver app.routes.ts).
 *
 * A diferencia del uso "clásico" de un resolver (bloquear la activación de la
 * ruta hasta tener los datos), este es deliberadamente NO bloqueante: dispara
 * `TenantResolverService.resolve()` y retorna de inmediato, sin esperar la
 * respuesta HTTP. Es coherente con "la UI nunca espera a la red"
 * (docs/frontend-architecture.md §3.4): el Router activa el layout al
 * instante, y ese layout renderiza según los signals de
 * `TenantStore`/`MenuStore` a medida que van cambiando ('resolving' ->
 * 'resolved' | 'notFound' | 'suspended' | 'error').
 *
 * Vuelve a ejecutarse automáticamente cada vez que cambian `tenantSlug`/
 * `branchSlug` en la URL (comportamiento por defecto del Router ante cambios
 * de parámetros); la concurrencia entre ejecuciones sucesivas ya la resuelve
 * `TenantResolverService` internamente (switchMap).
 */
export const tenantResolver: ResolveFn<void> = (route) => {
  const tenantResolverService = inject(TenantResolverService);

  const tenantSlug = route.paramMap.get('tenantSlug');
  const branchSlug = route.paramMap.get('branchSlug');

  if (!tenantSlug || !branchSlug) {
    // No debería ocurrir: la ruta exige ambos segmentos como obligatorios. Si
    // pasa, es un bug de configuración de rutas, no un error de negocio del
    // comensal — por eso no se toca `TenantStore` (nada que resolver).
    console.error('[tenantResolver] Ruta activada sin tenantSlug/branchSlug.');
    return;
  }

  tenantResolverService.resolve(tenantSlug, branchSlug);
};
