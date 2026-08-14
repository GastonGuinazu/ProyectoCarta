import { Injectable } from '@nestjs/common';
import { PromoStatus } from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { TenantContextService } from '../core';
import { PromoNotFoundException, OfferValidationException } from './admin-engagement.exceptions';
import type { AdminPromoRecord } from './admin-engagement.types';
import type { WritePromoDto } from './dto/write-promo.dto';
import {
  derivePromoStatus,
  parseDiscount,
  resolveOfferTargets,
} from './offer-write.util';
import { PromoRepository } from './promo/promo.repository';

@Injectable()
export class AdminPromoService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly promoRepository: PromoRepository,
    private readonly catalogService: CatalogService,
  ) {}

  async list(): Promise<{ readonly items: readonly AdminPromoRecord[] }> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const items = await this.promoRepository.findAdminList(tenantId);
    return { items: items.map(withLiveStatus) };
  }

  async getById(promoId: string): Promise<AdminPromoRecord> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.promoRepository.findAdminById(tenantId, promoId);
    if (!existing) {
      throw new PromoNotFoundException();
    }
    return withLiveStatus(existing);
  }

  async create(dto: WritePromoDto): Promise<AdminPromoRecord> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const input = await this.toWriteInput(dto);
    return withLiveStatus(await this.promoRepository.createAdmin(tenantId, input));
  }

  async update(promoId: string, dto: WritePromoDto): Promise<AdminPromoRecord> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.promoRepository.findAdminById(tenantId, promoId);
    if (!existing) {
      throw new PromoNotFoundException();
    }
    const input = await this.toWriteInput(dto);
    return withLiveStatus(
      await this.promoRepository.updateAdmin(tenantId, promoId, input),
    );
  }

  async remove(promoId: string): Promise<void> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.promoRepository.findAdminById(tenantId, promoId);
    if (!existing) {
      throw new PromoNotFoundException();
    }
    await this.promoRepository.deleteAdmin(tenantId, promoId);
  }

  private async toWriteInput(dto: WritePromoDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new OfferValidationException('startAt', 'Las fechas no son válidas.');
    }
    if (endAt <= startAt) {
      throw new OfferValidationException(
        'endAt',
        'La fecha de fin tiene que ser posterior a la de inicio.',
      );
    }
    const discount = parseDiscount(dto);
    const targets = await resolveOfferTargets(this.catalogService, dto);
    return {
      name: dto.name,
      description: dto.description ?? null,
      ...discount,
      ...targets,
      startAt,
      endAt,
      status: derivePromoStatus(startAt, endAt),
    };
  }
}

function withLiveStatus(promo: AdminPromoRecord): AdminPromoRecord {
  if (promo.status === PromoStatus.CANCELLED) {
    return promo;
  }
  return { ...promo, status: derivePromoStatus(promo.startAt, promo.endAt) };
}
