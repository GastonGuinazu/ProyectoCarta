import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { EngagementModule } from '../engagement/engagement.module';
import { MediaModule } from '../media/media.module';
import { TenantModule } from '../tenant/tenant.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

/**
 * Capa de composición de lectura para el menú público
 * (docs/backend-architecture.md §2.1, §2.3 punto 4). No tiene entidades propias ni
 * lógica de escritura: orquesta los Services exportados por los módulos de dominio.
 *
 * Hoy importa `TenantModule` (datos básicos de Sucursal), `CatalogModule`
 * (árbol de categorías/productos, combos, y catálogos globales de
 * alérgenos/tags dietéticos), `EngagementModule` (resolución de
 * `activePromotion` vigente por Producto/Combo) y `MediaModule` (resolución
 * en batch de `imageUrl`/`images`/`webAr`). A futuro solo falta completar
 * `meta` (docs/api-contracts.md §3).
 */
@Module({
  imports: [TenantModule, CatalogModule, EngagementModule, MediaModule],
  controllers: [MenuController],
  providers: [MenuService],
})
export class PublicMenuModule {}
