export type PlatformTenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

export interface PlatformTenantListItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: PlatformTenantStatus;
  readonly createdAt: string;
  readonly branchCount: number;
  readonly ownerEmail: string | null;
}

export interface CreatePlatformTenantPayload {
  readonly commercialName: string;
  readonly tenantSlug: string;
  readonly branchName: string;
  readonly branchSlug: string;
  readonly ownerFullName: string;
  readonly ownerEmail: string;
  readonly ownerPassword: string;
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
