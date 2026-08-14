import { RoleType } from '@prisma/client';

export type JwtRoleScope = 'PLATFORM' | 'TENANT' | 'BRANCH';

/** Claim de rol embebido en el access token (docs/api-contracts.md §4.5). */
export interface JwtRoleClaim {
  readonly role: RoleType;
  readonly scope: JwtRoleScope;
  readonly branchId: string | null;
}

/** Payload firmado del JWT de aplicación. No incluye `branchId` suelto: vive en `roles`. */
export interface JwtPayload {
  readonly sub: string;
  readonly tenantId: string | null;
  readonly roles: readonly JwtRoleClaim[];
}

/** Usuario autenticado que Passport deja en `request.user`. */
export interface AuthenticatedUser {
  readonly id: string;
  readonly tenantId: string | null;
  readonly roles: readonly JwtRoleClaim[];
}
