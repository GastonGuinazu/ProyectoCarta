import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType } from '@prisma/client';
import type { AuthenticatedRequest } from '../authenticated-request';
import { REQUIRED_ROLE_KEY } from '../decorators/required-role.decorator';

const ROLE_RANK: Record<RoleType, number> = {
  [RoleType.STAFF]: 1,
  [RoleType.ADMIN]: 2,
  [RoleType.OWNER]: 3,
  [RoleType.PLATFORM_ADMIN]: 4,
};

/**
 * Estructura inicial de RBAC (docs/backend-architecture.md §3.2).
 * Si no hay `@RequiredRole()`, deja pasar. El alcance por sucursal
 * (`BranchScopeGuard`) queda para un ticket posterior.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.getAllAndOverride<RoleType | undefined>(
      REQUIRED_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user || user.roles.length === 0) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'No tenés permiso para esta acción.',
      });
    }

    const highestRank = Math.max(
      ...user.roles.map((assignment) => ROLE_RANK[assignment.role]),
    );
    if (highestRank < ROLE_RANK[requiredRole]) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'No tenés permiso para esta acción.',
      });
    }

    return true;
  }
}
