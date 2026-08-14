import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { TenantContextService } from '../core';
import {
  HappyHourNotFoundException,
  OfferValidationException,
} from './admin-engagement.exceptions';
import type { AdminHappyHourRecord } from './admin-engagement.types';
import type { WriteHappyHourDto } from './dto/write-happy-hour.dto';
import { parseDiscount, resolveOfferTargets } from './offer-write.util';
import { HappyHourRepository } from './happy-hour/happy-hour.repository';

@Injectable()
export class AdminHappyHourService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly happyHourRepository: HappyHourRepository,
    private readonly catalogService: CatalogService,
  ) {}

  async list(): Promise<{ readonly items: readonly AdminHappyHourRecord[] }> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    return { items: await this.happyHourRepository.findAdminList(tenantId) };
  }

  async getById(happyHourId: string): Promise<AdminHappyHourRecord> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.happyHourRepository.findAdminById(
      tenantId,
      happyHourId,
    );
    if (!existing) {
      throw new HappyHourNotFoundException();
    }
    return existing;
  }

  async create(dto: WriteHappyHourDto): Promise<AdminHappyHourRecord> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const input = await this.toWriteInput(dto);
    return this.happyHourRepository.createAdmin(tenantId, input);
  }

  async update(
    happyHourId: string,
    dto: WriteHappyHourDto,
  ): Promise<AdminHappyHourRecord> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.happyHourRepository.findAdminById(
      tenantId,
      happyHourId,
    );
    if (!existing) {
      throw new HappyHourNotFoundException();
    }
    const input = await this.toWriteInput(dto);
    return this.happyHourRepository.updateAdmin(tenantId, happyHourId, input);
  }

  async remove(happyHourId: string): Promise<void> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.happyHourRepository.findAdminById(
      tenantId,
      happyHourId,
    );
    if (!existing) {
      throw new HappyHourNotFoundException();
    }
    await this.happyHourRepository.deleteAdmin(tenantId, happyHourId);
  }

  private async toWriteInput(dto: WriteHappyHourDto) {
    if (dto.startMinuteOfDay === dto.endMinuteOfDay) {
      throw new OfferValidationException(
        'endMinuteOfDay',
        'El horario de fin tiene que ser distinto al de inicio.',
      );
    }
    const discount = parseDiscount({ ...dto, priority: dto.priority ?? 10 });
    const targets = await resolveOfferTargets(this.catalogService, dto);
    return {
      name: dto.name,
      ...discount,
      ...targets,
      daysOfWeek: dto.daysOfWeek,
      startMinuteOfDay: dto.startMinuteOfDay,
      endMinuteOfDay: dto.endMinuteOfDay,
      enabled: dto.enabled ?? true,
    };
  }
}
