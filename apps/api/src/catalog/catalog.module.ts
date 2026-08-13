import { Module } from '@nestjs/common';
import { CategoryRepository } from './category/category.repository';
import { ComboRepository } from './combo/combo.repository';
import { PlatformCatalogRepository } from './platform-catalog.repository';
import { ProductRepository } from './product/product.repository';
import { CatalogService } from './catalog.service';

/**
 * Módulo de dominio Catalog (docs/domain-modules.md §3,
 * docs/backend-architecture.md §2.1/§2.2). No importa `TenantModule` ni
 * declara `PrismaService`/`TENANT_PRISMA_CLIENT` como providers propios:
 * ambos ya están registrados una única vez en `CoreModule` (`@Global()`), y
 * los Repositories de este módulo los reciben por inyección directa. Volver
 * a listarlos acá crearía instancias "sombra" separadas del singleton
 * global — ver explicación completa dada al usuario antes de este código.
 *
 * Solo se exporta el Service, nunca los Repositories (regla de exportación
 * explícita, docs/backend-architecture.md §2.3).
 */
@Module({
  providers: [
    CategoryRepository,
    ProductRepository,
    ComboRepository,
    PlatformCatalogRepository,
    CatalogService,
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
