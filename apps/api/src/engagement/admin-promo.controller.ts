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
import { RequiredRole } from '../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ParseUuidLikePipe, RequireTenantContext } from '../core';
import { AdminPromoService } from './admin-promo.service';
import { WritePromoDto } from './dto/write-promo.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@Controller('admin/engagement/promos')
export class AdminPromoController {
  constructor(private readonly adminPromoService: AdminPromoService) {}

  @Get()
  list() {
    return this.adminPromoService.list();
  }

  @Get(':id')
  getById(@Param('id', ParseUuidLikePipe) id: string) {
    return this.adminPromoService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: WritePromoDto) {
    return this.adminPromoService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUuidLikePipe) id: string,
    @Body() dto: WritePromoDto,
  ) {
    return this.adminPromoService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUuidLikePipe) id: string): Promise<void> {
    await this.adminPromoService.remove(id);
  }
}
