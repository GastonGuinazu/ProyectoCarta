import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../core';
import { SettingsBranchNotFoundException } from '../settings/admin-settings.exceptions';
import { TenantService } from '../tenant.service';
import {
  AdminBranchNotFoundException,
  BranchLimitReachedException,
  BranchPatchEmptyException,
  SourceBranchNotFoundException,
} from './admin-branch.exceptions';
import type {
  AdminBranchList,
  AdminBranchListItem,
  CreateAdminBranchInput,
  UpdateAdminBranchInput,
} from './admin-branch.types';
import { BranchService } from './branch.service';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class AdminBranchService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly tenantService: TenantService,
    private readonly branchService: BranchService,
  ) {}

  async list(): Promise<AdminBranchList> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const limits = await this.tenantService.findCatalogLimits(tenantId);
    const branding = await this.tenantService.findPublicBranding(tenantId);
    if (!limits || !branding) {
      throw new SettingsBranchNotFoundException();
    }

    const branches = await this.branchService.listForAdmin(tenantId);
    return {
      tenantSlug: branding.slug,
      maxBranches: limits.maxBranches,
      branches,
    };
  }

  async create(input: CreateAdminBranchInput): Promise<AdminBranchListItem> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const limits = await this.tenantService.findCatalogLimits(tenantId);
    if (!limits) {
      throw new SettingsBranchNotFoundException();
    }

    const currentCount = await this.branchService.countByTenant(tenantId);
    if (currentCount >= limits.maxBranches) {
      throw new BranchLimitReachedException(limits.maxBranches);
    }

    const copyFromBranchId = await this.resolveCopySource(
      tenantId,
      input.copyCatalogFromBranchId,
    );

    return this.branchService.createForTenant(tenantId, {
      name: input.name,
      slug: input.slug,
      timezone: DEFAULT_TIMEZONE,
      copyFromBranchId,
    });
  }

  async update(
    branchId: string,
    input: UpdateAdminBranchInput,
  ): Promise<AdminBranchListItem> {
    if (!input.name && !input.slug) {
      throw new BranchPatchEmptyException();
    }

    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const updated = await this.branchService.updateForAdmin(
      tenantId,
      branchId,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
      },
    );
    if (!updated) {
      throw new AdminBranchNotFoundException();
    }
    return updated;
  }

  private async resolveCopySource(
    tenantId: string,
    requestedId: string | undefined,
  ): Promise<string | undefined> {
    const sourceId =
      requestedId ?? (await this.branchService.findPrimaryId(tenantId));
    if (!sourceId) {
      return undefined;
    }

    const existing = await this.branchService.findExistingIds(tenantId, [
      sourceId,
    ]);
    if (existing.length !== 1) {
      throw new SourceBranchNotFoundException();
    }
    return sourceId;
  }
}
