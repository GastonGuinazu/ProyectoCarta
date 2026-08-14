import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { TenantModule } from '../tenant/tenant.module';
import { AdminHappyHourController } from './admin-happy-hour.controller';
import { AdminHappyHourService } from './admin-happy-hour.service';
import { AdminProductOffersController } from './admin-product-offers.controller';
import { AdminProductOffersService } from './admin-product-offers.service';
import { AdminPromoController } from './admin-promo.controller';
import { AdminPromoService } from './admin-promo.service';
import { EngagementService } from './engagement.service';
import { HappyHourRepository } from './happy-hour/happy-hour.repository';
import { PromoRepository } from './promo/promo.repository';

/**
 * Dominio Engagement (docs/domain-modules.md §4).
 * Importa CatalogModule para validar targets (producto/categoría/combo)
 * (docs/backend-architecture.md §2.2: Engagement → Catalog).
 */
@Module({
  imports: [TenantModule, CatalogModule],
  controllers: [
    AdminProductOffersController,
    AdminPromoController,
    AdminHappyHourController,
  ],
  providers: [
    PromoRepository,
    HappyHourRepository,
    EngagementService,
    AdminPromoService,
    AdminHappyHourService,
    AdminProductOffersService,
  ],
  exports: [EngagementService],
})
export class EngagementModule {}
