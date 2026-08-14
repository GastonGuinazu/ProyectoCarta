import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { TenantModule } from '../tenant/tenant.module';
import { AdminCategoryController } from './category/admin-category.controller';
import { AdminCategoryService } from './category/admin-category.service';
import { CategoryRepository } from './category/category.repository';
import { AdminComboController } from './combo/admin-combo.controller';
import { AdminComboService } from './combo/admin-combo.service';
import { ComboRepository } from './combo/combo.repository';
import { AdminCatalogTagsController } from './admin-catalog-tags.controller';
import { PlatformCatalogRepository } from './platform-catalog.repository';
import { AdminProductController } from './product/admin-product.controller';
import { AdminProductService } from './product/admin-product.service';
import { ProductRepository } from './product/product.repository';
import { CatalogService } from './catalog.service';

/**
 * Módulo de dominio Catalog (docs/domain-modules.md §3,
 * docs/backend-architecture.md §2.1/§2.2). No declara `PrismaService`/
 * `TENANT_PRISMA_CLIENT` como providers propios: ambos ya están en
 * `CoreModule` (`@Global()`).
 *
 * Importa `TenantModule` (límites de plan / sucursales) y `MediaModule`
 * (validar `MediaAsset` al crear productos). Solo se exporta el Service
 * de lectura pública; el CRUD admin queda encapsulado en este módulo.
 */
@Module({
  imports: [TenantModule, MediaModule],
  controllers: [
    AdminProductController,
    AdminCategoryController,
    AdminComboController,
    AdminCatalogTagsController,
  ],
  providers: [
    CategoryRepository,
    ProductRepository,
    ComboRepository,
    PlatformCatalogRepository,
    CatalogService,
    AdminProductService,
    AdminCategoryService,
    AdminComboService,
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
