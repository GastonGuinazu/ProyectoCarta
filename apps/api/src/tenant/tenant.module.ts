import { Module } from '@nestjs/common';
import { AdminBranchController } from './branch/admin-branch.controller';
import { AdminBranchService } from './branch/admin-branch.service';
import { BranchRepository } from './branch/branch.repository';
import { BranchService } from './branch/branch.service';
import { AdminPlatformController } from './platform/admin-platform.controller';
import { AdminPlatformRepository } from './platform/admin-platform.repository';
import { AdminPlatformService } from './platform/admin-platform.service';
import { AdminSettingsController } from './settings/admin-settings.controller';
import { AdminSettingsService } from './settings/admin-settings.service';
import { TenantRepository } from './tenant.repository';
import { TenantService } from './tenant.service';
import { UserRepository } from './user/user.repository';
import { UserService } from './user/user.service';

/**
 * Módulo de dominio Tenant (docs/domain-modules.md §2, docs/backend-architecture.md
 * §2.1). Es el módulo raíz del grafo de dependencias: nunca debe importar otro
 * módulo de dominio.
 *
 * Alcance ACTUAL: Sucursal (menú público) + lectura de User para login
 * (`UserService`, consumido por `AuthModule`) + settings de marca/contacto
 * + alta de tenants y reset de clave del OWNER (`AdminPlatformController`,
 * solo PLATFORM_ADMIN).
 *
 * Solo se exporta el Service, nunca el Repository (regla de exportación explícita,
 * docs/backend-architecture.md §2.3).
 */
@Module({
  controllers: [
    AdminSettingsController,
    AdminPlatformController,
    AdminBranchController,
  ],
  providers: [
    BranchRepository,
    BranchService,
    TenantRepository,
    TenantService,
    UserRepository,
    UserService,
    AdminSettingsService,
    AdminPlatformRepository,
    AdminPlatformService,
    AdminBranchService,
  ],
  exports: [BranchService, TenantService, UserService],
})
export class TenantModule {}
