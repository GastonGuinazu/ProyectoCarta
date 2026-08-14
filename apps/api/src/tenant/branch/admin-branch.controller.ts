import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { RequiredRole } from '../../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ParseUuidLikePipe, RequireTenantContext } from '../../core';
import { AdminBranchService } from './admin-branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

/**
 * Listado, alta y rename de sucursales del Tenant activo.
 * El `tenantId` sale del TenantContext (JWT o `X-Tenant-Id` de plataforma).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@Controller('admin/branches')
export class AdminBranchController {
  constructor(private readonly adminBranchService: AdminBranchService) {}

  @Get()
  list() {
    return this.adminBranchService.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBranchDto) {
    return this.adminBranchService.create({
      name: dto.name,
      slug: dto.slug,
      copyCatalogFromBranchId: dto.copyCatalogFromBranchId,
    });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUuidLikePipe) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.adminBranchService.update(id, {
      name: dto.name,
      slug: dto.slug,
    });
  }
}
