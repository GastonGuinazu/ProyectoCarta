import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { TenantModule } from '../tenant/tenant.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { PublicAnalyticsController } from './public-analytics.controller';

/**
 * Dominio Analytics (docs/domain-modules.md §6, docs/backend-architecture.md §2.1).
 * Terminal: importa Catalog y Tenant para validar entidades y sucursal;
 * ningún otro módulo de dominio lo importa.
 */
@Module({
  imports: [CatalogModule, TenantModule],
  controllers: [PublicAnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsRepository, AnalyticsService],
})
export class AnalyticsModule {}
