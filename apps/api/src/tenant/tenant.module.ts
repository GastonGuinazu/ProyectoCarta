import { Module } from '@nestjs/common';
import { BranchRepository } from './branch/branch.repository';
import { BranchService } from './branch/branch.service';

/**
 * Módulo de dominio Tenant (docs/domain-modules.md §2, docs/backend-architecture.md
 * §2.1). Es el módulo raíz del grafo de dependencias: nunca debe importar otro
 * módulo de dominio.
 *
 * Alcance ACTUAL deliberadamente parcial: solo la porción de Sucursal necesaria
 * para el flujo de lectura de `PublicMenuModule`. `Tenant`, `User`, `RoleAssignment`
 * y `Plan` (CRUD, RBAC, límites de plan) quedan pendientes de tickets futuros.
 *
 * Solo se exporta el Service, nunca el Repository (regla de exportación explícita,
 * docs/backend-architecture.md §2.3).
 */
@Module({
  providers: [BranchRepository, BranchService],
  exports: [BranchService],
})
export class TenantModule {}
