import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CurrentTenant, Public, type TenantContext } from '../core';
import { AnalyticsService } from './analytics.service';
import { PublicMenuEventDto } from './dto/public-menu-event.dto';

/**
 * Ingesta pública de eventos de carta (docs/domain-modules.md §6).
 * El tenant/sucursal salen de la ruta (TenantResolutionGuard), nunca del body.
 * Responde 204 siempre que el DTO sea válido: un evento duplicado no se filtra.
 */
@Public()
@Controller('menu/public/:tenantSlug/:branchSlug')
export class PublicAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  async record(
    @CurrentTenant() tenantContext: TenantContext | undefined,
    @Body() dto: PublicMenuEventDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    if (!tenantContext?.branchId) {
      return;
    }
    await this.analyticsService.recordPublicEvent({
      kind: dto.kind,
      sessionId: dto.sessionId,
      query: dto.query,
      filterKind: dto.filterKind,
      tagId: dto.tagId,
      productId: dto.productId,
      durationMs: dto.durationMs,
      userAgent: userAgent ?? null,
    });
  }
}
