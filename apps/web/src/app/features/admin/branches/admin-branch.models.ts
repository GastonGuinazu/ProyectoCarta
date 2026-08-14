export type BranchOperationalStatus =
  | 'OPEN'
  | 'CLOSED_TEMPORARILY'
  | 'MAINTENANCE';

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

export interface CreateAdminBranchPayload {
  readonly name: string;
  readonly slug: string;
  readonly copyCatalogFromBranchId?: string;
}

export interface UpdateAdminBranchPayload {
  readonly name?: string;
  readonly slug?: string;
}
