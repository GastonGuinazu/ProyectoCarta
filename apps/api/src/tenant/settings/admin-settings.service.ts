import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../core';
import { BranchService } from '../branch/branch.service';
import { TenantService } from '../tenant.service';
import { SettingsBranchNotFoundException } from './admin-settings.exceptions';
import type {
  AdminBranchSettings,
  AdminBranchSettingsPatch,
} from './admin-settings.types';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly tenantService: TenantService,
    private readonly branchService: BranchService,
  ) {}

  async get(): Promise<AdminBranchSettings> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const branchId = this.tenantContextService.getBranchId();
    const settings = await this.tenantService.findAdminSettings(
      tenantId,
      branchId,
    );
    if (!settings) {
      throw new SettingsBranchNotFoundException();
    }
    return settings;
  }

  async patch(input: AdminBranchSettingsPatch): Promise<AdminBranchSettings> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const branchId = this.tenantContextService.getBranchId();
    const current = await this.tenantService.findAdminSettings(
      tenantId,
      branchId,
    );
    if (!current) {
      throw new SettingsBranchNotFoundException();
    }

    const tenantPatch = {
      ...(input.commercialName !== undefined
        ? { name: input.commercialName }
        : {}),
      ...(input.accentColor !== undefined
        ? { brandPrimaryColor: input.accentColor }
        : {}),
    };
    if (Object.keys(tenantPatch).length > 0) {
      await this.tenantService.updateBrandFields(tenantId, tenantPatch);
    }

    const branchPatch = {
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
      ...(input.instagram !== undefined ? { instagram: input.instagram } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.operationalStatus !== undefined
        ? { operationalStatus: input.operationalStatus }
        : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    };
    if (Object.keys(branchPatch).length > 0) {
      await this.branchService.updateContact(
        tenantId,
        current.branchId,
        branchPatch,
      );
    }

    const updated = await this.tenantService.findAdminSettings(
      tenantId,
      current.branchId,
    );
    if (!updated) {
      throw new SettingsBranchNotFoundException();
    }
    return updated;
  }
}
