import { Injectable } from '@nestjs/common';
import { Prisma, RoleType, TenantStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../core';
import {
  OwnerEmailTakenException,
  PlanNotConfiguredException,
  PlatformOwnerNotFoundException,
  PlatformTenantNotFoundException,
  TenantSlugTakenException,
} from './admin-platform.exceptions';
import type {
  CreatePlatformTenantInput,
  PlatformTenantCreated,
  PlatformTenantListItem,
} from './admin-platform.types';

const DEFAULT_BRANCH_NAME = 'Casa Matriz';
const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Alta de Tenant en la consola PLATFORM_ADMIN. Usa `PrismaService` crudo
 * (sin extensión de aislamiento): al crear el tenant todavía no hay
 * TenantContext, y Branch/User/RoleAssignment son tenant-scoped
 * (docs/backend-architecture.md §4.2 — vía auditada de plataforma).
 */
@Injectable()
export class AdminPlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

  listTenants(): Promise<PlatformTenantListItem[]> {
    return this.prisma.tenant
      .findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          _count: { select: { branches: true } },
          users: {
            where: {
              roleAssignments: { some: { role: RoleType.OWNER } },
            },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { email: true },
          },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          status: row.status,
          createdAt: row.createdAt,
          branchCount: row._count.branches,
          ownerEmail: row.users[0]?.email ?? null,
        })),
      );
  }

  async updateTenantStatus(
    tenantId: string,
    status: TenantStatus,
  ): Promise<PlatformTenantListItem> {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { branches: true } },
        users: {
          where: {
            roleAssignments: { some: { role: RoleType.OWNER } },
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { email: true },
        },
      },
    });
    if (!existing) {
      throw new PlatformTenantNotFoundException();
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
      select: { status: true },
    });

    return {
      id: existing.id,
      name: existing.name,
      slug: existing.slug,
      status: tenant.status,
      createdAt: existing.createdAt,
      branchCount: existing._count.branches,
      ownerEmail: existing.users[0]?.email ?? null,
    };
  }

  /**
   * Nueva clave del OWNER de ese Tenant. Prisma crudo (consola de
   * plataforma, sin TenantContext). Revoca todos los refresh del dueño.
   */
  async resetOwnerPassword(
    tenantId: string,
    passwordHash: string,
  ): Promise<PlatformTenantListItem> {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        _count: { select: { branches: true } },
        users: {
          where: {
            tenantId,
            roleAssignments: { some: { role: RoleType.OWNER } },
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, email: true },
        },
      },
    });
    if (!existing) {
      throw new PlatformTenantNotFoundException();
    }

    const owner = existing.users[0];
    if (!owner) {
      throw new PlatformOwnerNotFoundException();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: owner.id, tenantId },
        data: { passwordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId: owner.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return {
      id: existing.id,
      name: existing.name,
      slug: existing.slug,
      status: existing.status,
      createdAt: existing.createdAt,
      branchCount: existing._count.branches,
      ownerEmail: owner.email,
    };
  }

  async createTenantWithOwnerAndBranch(
    input: CreatePlatformTenantInput,
  ): Promise<PlatformTenantCreated> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const plan = await tx.plan.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (!plan) {
          throw new PlanNotConfiguredException();
        }

        const tenant = await tx.tenant.create({
          data: {
            name: input.commercialName,
            slug: input.tenantSlug,
            planId: plan.id,
            status: TenantStatus.TRIAL,
            defaultLanguage: 'es',
          },
        });

        const branch = await tx.branch.create({
          data: {
            tenantId: tenant.id,
            name: input.branchName || DEFAULT_BRANCH_NAME,
            slug: input.branchSlug,
            timezone: DEFAULT_TIMEZONE,
            operationalStatus: 'OPEN',
          },
        });

        const owner = await tx.user.create({
          data: {
            tenantId: tenant.id,
            fullName: input.ownerFullName,
            email: input.ownerEmail,
            passwordHash: input.passwordHash,
            status: UserStatus.ACTIVE,
          },
        });

        await tx.roleAssignment.create({
          data: {
            userId: owner.id,
            tenantId: tenant.id,
            branchId: null,
            role: RoleType.OWNER,
          },
        });

        return {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
          status: tenant.status,
          branchId: branch.id,
          branchSlug: branch.slug,
          branchName: branch.name,
          ownerId: owner.id,
          ownerEmail: owner.email,
        };
      });
    } catch (error: unknown) {
      if (error instanceof PlanNotConfiguredException) {
        throw error;
      }
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return;
    }

    const target = error.meta?.target;
    const fields = Array.isArray(target)
      ? target.map((item) => String(item))
      : typeof target === 'string'
        ? [target]
        : [];

    if (fields.some((field) => field.includes('email'))) {
      throw new OwnerEmailTakenException();
    }
    if (fields.some((field) => field.includes('slug'))) {
      throw new TenantSlugTakenException();
    }
  }
}
