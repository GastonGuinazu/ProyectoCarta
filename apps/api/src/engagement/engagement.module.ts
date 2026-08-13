import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { EngagementService } from './engagement.service';
import { HappyHourRepository } from './happy-hour/happy-hour.repository';
import { PromoRepository } from './promo/promo.repository';

/**
 * Módulo de dominio Engagement (docs/domain-modules.md §4,
 * docs/backend-architecture.md §2.1/§2.2). A diferencia de `CatalogModule`,
 * SÍ importa explícitamente otro módulo de dominio (`TenantModule`): necesita
 * `BranchService.getBranchDetails()` para resolver la `timezone` de la
 * Sucursal, crítica para evaluar Happy Hours (docs/domain-modules.md §4.5,
 * "Engagement depende de Tenant y Branch... su vigencia horaria depende de la
 * zona horaria de la Sucursal"). No importa `CatalogModule`: no necesita
 * ningún Service de Catalog en tiempo de ejecución, solo tipos (import de
 * TypeScript, sin dependencia de Nest) desde `catalog.types.ts`.
 *
 * Solo se exporta el Service, nunca los Repositories.
 */
@Module({
  imports: [TenantModule],
  providers: [PromoRepository, HappyHourRepository, EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
