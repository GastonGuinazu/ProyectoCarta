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
import { AdminProductService } from './admin-product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/**
 * CRUD admin de Productos (`docs/api-contracts.md` §5).
 * El `tenantId` sale del `TenantContext` (JWT / `X-Tenant-Id`), nunca del body.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@Controller('admin/catalog/products')
export class AdminProductController {
  constructor(private readonly adminProductService: AdminProductService) {}

  @Get()
  list() {
    return this.adminProductService.list();
  }

  @Get(':id')
  getById(@Param('id', ParseUuidLikePipe) id: string) {
    return this.adminProductService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto) {
    return this.adminProductService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUuidLikePipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.adminProductService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUuidLikePipe) id: string,
  ): Promise<void> {
    await this.adminProductService.remove(id);
  }
}
