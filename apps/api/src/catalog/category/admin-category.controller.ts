import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { RequiredRole } from '../../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ParseUuidLikePipe, RequireTenantContext } from '../../core';
import { AdminCategoryService } from './admin-category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/**
 * CRUD admin de Categorías (`docs/api-contracts.md` §5.6+).
 * El `tenantId` sale del `TenantContext` (JWT / `X-Tenant-Id`), nunca del body.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@Controller('admin/catalog/categories')
export class AdminCategoryController {
  constructor(private readonly adminCategoryService: AdminCategoryService) {}

  @Get()
  list() {
    return this.adminCategoryService.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCategoryDto) {
    return this.adminCategoryService.create(dto);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderCategoriesDto) {
    return this.adminCategoryService.reorder(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUuidLikePipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.adminCategoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUuidLikePipe) id: string,
  ): Promise<void> {
    await this.adminCategoryService.remove(id);
  }
}
