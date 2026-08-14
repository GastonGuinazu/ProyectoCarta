import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { RequiredRole } from '../../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RequireTenantContext } from '../../core';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateBranchSettingsDto } from './dto/update-branch-settings.dto';

/**
 * Settings de identidad visual + contacto de la sucursal activa
 * (`docs/api-contracts.md` §5.10). El `tenantId` sale del TenantContext.
 * La sucursal sale de `X-Branch-Id` si viene y pertenece al tenant; si no,
 * la más antigua.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@Controller('admin/settings/branch')
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  get() {
    return this.adminSettingsService.get();
  }

  @Patch()
  patch(@Body() dto: UpdateBranchSettingsDto) {
    return this.adminSettingsService.patch(dto);
  }
}
