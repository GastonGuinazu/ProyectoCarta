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
import { AdminHappyHourService } from './admin-happy-hour.service';
import { WriteHappyHourDto } from './dto/write-happy-hour.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@Controller('admin/engagement/happy-hours')
export class AdminHappyHourController {
  constructor(private readonly adminHappyHourService: AdminHappyHourService) {}

  @Get()
  list() {
    return this.adminHappyHourService.list();
  }

  @Get(':id')
  getById(@Param('id', ParseUuidLikePipe) id: string) {
    return this.adminHappyHourService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: WriteHappyHourDto) {
    return this.adminHappyHourService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUuidLikePipe) id: string,
    @Body() dto: WriteHappyHourDto,
  ) {
    return this.adminHappyHourService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUuidLikePipe) id: string): Promise<void> {
    await this.adminHappyHourService.remove(id);
  }
}
