import type { BranchOperationalStatus } from '@prisma/client';

export interface AdminBranchListItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly operationalStatus: BranchOperationalStatus;
}

export interface AdminBranchList {
  readonly tenantSlug: string;
  readonly maxBranches: number;
  readonly branches: readonly AdminBranchListItem[];
}

export interface CreateAdminBranchInput {
  readonly name: string;
  readonly slug: string;
  readonly copyCatalogFromBranchId?: string;
}

export interface UpdateAdminBranchInput {
  readonly name?: string;
  readonly slug?: string;
}
