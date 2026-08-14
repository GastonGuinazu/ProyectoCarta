import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { RequiredRole } from '../../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ParseUuidLikePipe, SkipTenantContext } from '../../core';
import { AdminPlatformService } from './admin-platform.service';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';
import { ResetOwnerPasswordDto } from './dto/reset-owner-password.dto';
import { UpdatePlatformTenantStatusDto } from './dto/update-platform-tenant-status.dto';

/**
 * Consola de plataforma: alta de restaurantes (Tenant + OWNER + Casa Matriz).
 * Solo `PLATFORM_ADMIN`. Cross-tenant con Prisma crudo
 * (docs/backend-architecture.md §4.2). `@SkipTenantContext()`: un
 * `X-Tenant-Id` de impersonación (p. ej. el seed local `don-luigi`) no
 * debe 404-ear el listado ni el alta.
 */
@SkipTenantContext()
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.PLATFORM_ADMIN)
@Controller('admin/platform/tenants')
export class AdminPlatformController {
  constructor(private readonly adminPlatformService: AdminPlatformService) {}

  @Get()
  list() {
    return this.adminPlatformService.listTenants();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePlatformTenantDto) {
    return this.adminPlatformService.createTenant(dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUuidLikePipe) tenantId: string,
    @Body() dto: UpdatePlatformTenantStatusDto,
  ) {
    return this.adminPlatformService.updateTenantStatus(tenantId, dto.status);
  }

  @Post(':id/reset-owner-password')
  @HttpCode(HttpStatus.OK)
  resetOwnerPassword(
    @Param('id', ParseUuidLikePipe) tenantId: string,
    @Body() dto: ResetOwnerPasswordDto,
  ) {
    return this.adminPlatformService.resetOwnerPassword(tenantId, dto.newPassword);
  }
}
