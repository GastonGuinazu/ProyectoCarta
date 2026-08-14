import { Controller, Get, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { RequiredRole } from '../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireTenantContext } from '../core';
import { CatalogService } from './catalog.service';

/**
 * Catálogo global de alérgenos y tags dietéticos (`features-spec.md` §5).
 * Ruta fija `admin/catalog/tags` (no `products/:id`) para no chocar con UUID.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@Controller('admin/catalog/tags')
export class AdminCatalogTagsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list() {
    return this.catalogService.getPlatformCatalogs();
  }
}
