import type { TenantStatus } from '@prisma/client';

export interface CreatePlatformTenantInput {
  readonly commercialName: string;
  readonly tenantSlug: string;
  readonly branchName: string;
  readonly branchSlug: string;
  readonly ownerFullName: string;
  readonly ownerEmail: string;
  readonly passwordHash: string;
}

export interface PlatformTenantCreated {
  readonly tenantId: string;
  readonly tenantSlug: string;
  readonly tenantName: string;
  readonly status: string;
  readonly branchId: string;
  readonly branchSlug: string;
  readonly branchName: string;
  readonly ownerId: string;
  readonly ownerEmail: string;
}

export interface PlatformTenantListItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: TenantStatus;
  readonly createdAt: Date;
  readonly branchCount: number;
  readonly ownerEmail: string | null;
}
