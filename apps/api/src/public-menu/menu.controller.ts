import { Controller, Get, NotFoundException } from '@nestjs/common';
import { CurrentTenant, type TenantContext } from '../core';
import { MenuService, type PublicMenuResponse } from './menu.service';

/**
 * `GET /api/v1/menu/public/:tenantSlug/:branchSlug` (docs/api-contracts.md §3).
 * Acceso público, sin autenticación. Devuelve `branch`, `categories`
 * (árbol de categorías/productos), `combos` y `catalogs` (alérgenos/tags
 * dietéticos globales) — ver `MenuService.getPublicMenu`.
 *
 * La resolución de `:tenantSlug`/`:branchSlug` la hace `TenantResolutionGuard`,
 * registrado GLOBALMENTE como `APP_GUARD` en `CoreModule` — por eso esta ruta ya
 * pasa por él sin necesidad de `@UseGuards()` local (agregarlo de nuevo aquí
 * ejecutaría la resolución de tenant dos veces). El resultado de esa resolución
 * se lee acá vía `@CurrentTenant()`, que expone el mismo `TenantContext` que ya
 * quedó disponible en `AsyncLocalStorage` para el resto del pipeline.
 */
@Controller('menu/public/:tenantSlug/:branchSlug')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  async getPublicMenu(
    @CurrentTenant() tenantContext?: TenantContext,
  ): Promise<PublicMenuResponse> {
    if (!tenantContext?.branchId) {
      // Defensivo: esta ruta siempre debería tener branchId resuelto por el Guard.
      throw new NotFoundException();
    }

    return this.menuService.getPublicMenu(tenantContext.branchId);
  }
}
