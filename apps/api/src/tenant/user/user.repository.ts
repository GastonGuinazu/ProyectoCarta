import { Injectable } from '@nestjs/common';
import { Prisma, RoleType, TenantStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../core';

const AUTH_USER_INCLUDE = {
  roleAssignments: true,
  tenant: {
    include: {
      plan: true,
      branches: {
        select: { id: true, slug: true, name: true },
        orderBy: { name: 'asc' as const },
      },
    },
  },
} satisfies Prisma.UserInclude;

export interface AuthUserRecord {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly passwordHash: string;
  readonly status: UserStatus;
  readonly preferredLanguage: string;
  readonly tenantId: string | null;
  readonly tenant: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly status: TenantStatus;
    readonly planName: string;
  } | null;
  readonly roleAssignments: readonly {
    readonly role: RoleType;
    readonly branchId: string | null;
  }[];
  readonly branches: readonly {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
  }[];
}

/**
 * Lectura de User/RoleAssignment para login. Usa `PrismaService` crudo porque
 * ocurre ANTES de existir `TenantContext` (email único global, PLATFORM_ADMIN
 * sin tenant). Misma excepción documentada que resolver Tenant por slug.
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmailForLogin(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: AUTH_USER_INCLUDE,
    });

    return user ? this.toAuthUserRecord(user) : null;
  }

  async findByIdForSession(userId: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: AUTH_USER_INCLUDE,
    });

    return user ? this.toAuthUserRecord(user) : null;
  }

  private toAuthUserRecord(
    user: Prisma.UserGetPayload<{ include: typeof AUTH_USER_INCLUDE }>,
  ): AuthUserRecord {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
      tenantId: user.tenantId,
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            slug: user.tenant.slug,
            name: user.tenant.name,
            status: user.tenant.status,
            planName: user.tenant.plan.name,
          }
        : null,
      roleAssignments: user.roleAssignments.map((assignment) => ({
        role: assignment.role,
        branchId: assignment.branchId,
      })),
      branches: user.tenant?.branches ?? [],
    };
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Actualiza el hash filtrando por `id` + `tenantId` (nulo solo en
   * PLATFORM_ADMIN). El `id` sale del JWT, no del body.
   */
  async updatePasswordHash(input: {
    readonly userId: string;
    readonly tenantId: string | null;
    readonly passwordHash: string;
  }): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: input.userId, tenantId: input.tenantId },
      data: { passwordHash: input.passwordHash },
    });
    return result.count > 0;
  }
}
