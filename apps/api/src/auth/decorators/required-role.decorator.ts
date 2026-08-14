import { SetMetadata } from '@nestjs/common';
import { RoleType } from '@prisma/client';

export const REQUIRED_ROLE_KEY = 'requiredRole';

/**
 * Rol mínimo exigido. `RolesGuard` admite rangos superiores
 * (`PLATFORM_ADMIN > OWNER > ADMIN > STAFF`, docs/domain-modules.md §2.2).
 */
export const RequiredRole = (role: RoleType) =>
  SetMetadata(REQUIRED_ROLE_KEY, role);
