import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { RequiredRole } from '../../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ParseUuidLikePipe, RequireTenantContext } from '../../core';
import { AdminComboService } from './admin-combo.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';

/**
 * CRUD admin de Combos (`docs/api-contracts.md` §5.9).
 * El `tenantId` sale del `TenantContext` (JWT / `X-Tenant-Id`), nunca del body.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@Controller('admin/catalog/combos')
export class AdminComboController {
  constructor(private readonly adminComboService: AdminComboService) {}

  @Get()
  list() {
    return this.adminComboService.list();
  }

  @Get(':id')
  getById(@Param('id', ParseUuidLikePipe) id: string) {
    return this.adminComboService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateComboDto) {
    return this.adminComboService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUuidLikePipe) id: string,
    @Body() dto: UpdateComboDto,
  ) {
    return this.adminComboService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUuidLikePipe) id: string,
  ): Promise<void> {
    await this.adminComboService.remove(id);
  }
}
