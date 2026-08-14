export type AdminRole = 'PLATFORM_ADMIN' | 'OWNER' | 'ADMIN' | 'STAFF';
export type RoleScope = 'PLATFORM' | 'TENANT' | 'BRANCH';
export type AdminUserStatus = 'ACTIVE' | 'INVITED' | 'DISABLED';

export interface JwtRoleAssignment {
  readonly role: AdminRole;
  readonly scope: RoleScope;
  readonly branchId: string | null;
}

export interface AdminUser {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly preferredLanguage: string;
  readonly status: AdminUserStatus;
}

export interface AdminTenantSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly plan: string;
}

export interface AccessibleBranch {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

/** Body de `POST /api/v1/admin/auth/login` (docs/api-contracts.md §4.4). */
export interface AdminLoginResponse {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly user: AdminUser;
  readonly tenant: AdminTenantSummary | null;
  readonly roleAssignments: readonly JwtRoleAssignment[];
  readonly accessibleBranches: readonly AccessibleBranch[];
}
