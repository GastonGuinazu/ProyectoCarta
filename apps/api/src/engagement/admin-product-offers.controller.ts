import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { RequiredRole } from '../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireTenantContext } from '../core';
import { AdminProductOffersService } from './admin-product-offers.service';
import { ProductOffersQueryDto } from './dto/product-offers-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@Controller('admin/engagement')
export class AdminProductOffersController {
  constructor(
    private readonly adminProductOffersService: AdminProductOffersService,
  ) {}

  @Get('product-offers')
  list(@Query() query: ProductOffersQueryDto) {
    return this.adminProductOffersService.listForProduct(query.productId);
  }
}
