import { Injectable } from '@nestjs/common';
import {
  TenantRepository,
  type TenantCatalogLimits,
} from './tenant.repository';
import type {
  AdminBranchSettings,
  DetachedMediaRef,
  PublicTenantBranding,
} from './settings/admin-settings.types';

@Injectable()
export class TenantService {
  constructor(private readonly tenantRepository: TenantRepository) {}

  findCatalogLimits(tenantId: string): Promise<TenantCatalogLimits | null> {
    return this.tenantRepository.findCatalogLimits(tenantId);
  }

  findPublicBranding(tenantId: string): Promise<PublicTenantBranding | null> {
    return this.tenantRepository.findPublicBranding(tenantId);
  }

  findAdminSettings(
    tenantId: string,
    branchId?: string | null,
  ): Promise<AdminBranchSettings | null> {
    return this.tenantRepository.findAdminSettings(tenantId, branchId);
  }

  updateBrandFields(
    tenantId: string,
    data: {
      readonly name?: string;
      readonly brandPrimaryColor?: string | null;
    },
  ): Promise<void> {
    return this.tenantRepository.updateBrandFields(tenantId, data);
  }

  attachLogo(
    tenantId: string,
    mediaAssetId: string,
  ): Promise<DetachedMediaRef | null> {
    return this.tenantRepository.attachLogo(tenantId, mediaAssetId);
  }

  detachLogo(tenantId: string): Promise<DetachedMediaRef | null> {
    return this.tenantRepository.detachLogo(tenantId);
  }
}
