import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { RequiredRole } from '../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireTenantContext } from '../core';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.STAFF)
@RequireTenantContext()
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  summary(@Query() query: AnalyticsSummaryQueryDto) {
    return this.analyticsService.getSummary(query.periodDays ?? 7);
  }
}
