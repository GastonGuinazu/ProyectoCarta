import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type BranchOperationalStatus } from '@prisma/client';
import {
  TENANT_PRISMA_CLIENT,
  type TenantScopedPrismaClient,
} from '../../core';
import { BranchSlugTakenException } from './admin-branch.exceptions';
import type { BranchDetails } from './branch-details.type';

type BranchAdminSelect = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly operationalStatus: BranchOperationalStatus;
};

const BRANCH_ADMIN_SELECT = {
  id: true,
  name: true,
  slug: true,
  operationalStatus: true,
} as const;

/**
 * Única capa autorizada a hablar con Prisma para el modelo `Branch`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta el cliente extendido
 * (`TENANT_PRISMA_CLIENT`), nunca `PrismaService` crudo.
 */
@Injectable()
export class BranchRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * PRUEBA DE AISLAMIENTO END-TO-END (docs/backend-architecture.md §4.2): a
   * diferencia del resto de los métodos de Repository, este `where` NO incluye
   * `tenantId` a propósito. El objetivo es forzar a la Capa 2 (Prisma Client
   * Extension, ver `core/prisma/prisma-tenant.extension.ts`) a inyectarlo
   * automáticamente desde el `TenantContext` activo en `AsyncLocalStorage`.
   *
   * No repliques este patrón en otros métodos: la Capa 1 sigue exigiendo
   * `tenantId` explícito como parámetro obligatorio en cada Repository.
   */
  async getBranchDetails(branchId: string): Promise<BranchDetails | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId },
      include: {
        bannerMediaAsset: { select: { originalUrl: true, tenantId: true } },
      },
    });
    if (!branch) {
      return null;
    }

    return {
      id: branch.id,
      slug: branch.slug,
      name: branch.name,
      timezone: branch.timezone,
      address: branch.address,
      phone: branch.phone,
      whatsapp: branch.whatsapp,
      instagram: branch.instagram,
      bannerUrl:
        branch.bannerMediaAsset &&
        branch.bannerMediaAsset.tenantId === branch.tenantId
          ? branch.bannerMediaAsset.originalUrl
          : null,
      operationalStatus: branch.operationalStatus,
    };
  }

  async findPrimaryId(tenantId: string): Promise<string | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return branch?.id ?? null;
  }

  async updateContact(
    tenantId: string,
    branchId: string,
    data: {
      readonly phone?: string | null;
      readonly whatsapp?: string | null;
      readonly instagram?: string | null;
      readonly address?: string | null;
      readonly operationalStatus?: BranchOperationalStatus;
      readonly timezone?: string;
    },
  ): Promise<void> {
    await this.prisma.branch.updateMany({
      where: { tenantId, id: branchId },
      data: {
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.whatsapp !== undefined ? { whatsapp: data.whatsapp } : {}),
        ...(data.instagram !== undefined ? { instagram: data.instagram } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.operationalStatus !== undefined
          ? { operationalStatus: data.operationalStatus }
          : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      },
    });
  }

  async attachBanner(
    tenantId: string,
    branchId: string,
    mediaAssetId: string,
  ): Promise<{ readonly id: string; readonly originalUrl: string } | null> {
    const current = await this.prisma.branch.findFirst({
      where: { tenantId, id: branchId },
      select: {
        bannerMediaAssetId: true,
        bannerMediaAsset: { select: { id: true, originalUrl: true } },
      },
    });
    if (!current) {
      return null;
    }
    await this.prisma.branch.updateMany({
      where: { tenantId, id: branchId },
      data: { bannerMediaAssetId: mediaAssetId },
    });
    if (
      !current.bannerMediaAssetId ||
      current.bannerMediaAssetId === mediaAssetId ||
      !current.bannerMediaAsset
    ) {
      return null;
    }
    return {
      id: current.bannerMediaAsset.id,
      originalUrl: current.bannerMediaAsset.originalUrl,
    };
  }

  async detachBanner(
    tenantId: string,
    branchId: string,
  ): Promise<{ readonly id: string; readonly originalUrl: string } | null> {
    const current = await this.prisma.branch.findFirst({
      where: { tenantId, id: branchId },
      select: {
        bannerMediaAssetId: true,
        bannerMediaAsset: { select: { id: true, originalUrl: true } },
      },
    });
    if (!current?.bannerMediaAsset) {
      return null;
    }
    await this.prisma.branch.updateMany({
      where: { tenantId, id: branchId },
      data: { bannerMediaAssetId: null },
    });
    return {
      id: current.bannerMediaAsset.id,
      originalUrl: current.bannerMediaAsset.originalUrl,
    };
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.branch.count({ where: { tenantId } });
  }

  async listForAdmin(tenantId: string): Promise<readonly BranchAdminSelect[]> {
    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: BRANCH_ADMIN_SELECT,
    });
  }

  async createForTenant(
    tenantId: string,
    data: {
      readonly name: string;
      readonly slug: string;
      readonly timezone: string;
      readonly copyFromBranchId?: string;
    },
  ): Promise<BranchAdminSelect> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.create({
          data: {
            tenantId,
            name: data.name,
            slug: data.slug,
            timezone: data.timezone,
            operationalStatus: 'OPEN',
          },
          select: BRANCH_ADMIN_SELECT,
        });

        if (data.copyFromBranchId) {
          // Copia atómica de disponibilidad acotada (mismo Tenant). Si falla,
          // no queda un local nuevo con carta a medias.
          const fromBranchId = data.copyFromBranchId;
          const toBranchId = branch.id;
          const [categories, products, combos] = await Promise.all([
            tx.categoryBranchAvailability.findMany({
              where: { tenantId, branchId: fromBranchId },
              select: { categoryId: true },
            }),
            tx.productBranchAvailability.findMany({
              where: { tenantId, branchId: fromBranchId },
              select: { productId: true },
            }),
            tx.comboBranchAvailability.findMany({
              where: { tenantId, branchId: fromBranchId },
              select: { comboId: true },
            }),
          ]);

          if (categories.length > 0) {
            await tx.categoryBranchAvailability.createMany({
              data: categories.map((row) => ({
                tenantId,
                categoryId: row.categoryId,
                branchId: toBranchId,
              })),
              skipDuplicates: true,
            });
          }
          if (products.length > 0) {
            await tx.productBranchAvailability.createMany({
              data: products.map((row) => ({
                tenantId,
                productId: row.productId,
                branchId: toBranchId,
              })),
              skipDuplicates: true,
            });
          }
          if (combos.length > 0) {
            await tx.comboBranchAvailability.createMany({
              data: combos.map((row) => ({
                tenantId,
                comboId: row.comboId,
                branchId: toBranchId,
              })),
              skipDuplicates: true,
            });
          }
        }

        return branch;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BranchSlugTakenException();
      }
      throw error;
    }
  }

  async updateForAdmin(
    tenantId: string,
    branchId: string,
    patch: {
      readonly name?: string;
      readonly slug?: string;
    },
  ): Promise<BranchAdminSelect | null> {
    try {
      const updated = await this.prisma.branch.updateMany({
        where: { tenantId, id: branchId },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        },
      });
      if (updated.count === 0) {
        return null;
      }
      return this.prisma.branch.findFirst({
        where: { tenantId, id: branchId },
        select: BRANCH_ADMIN_SELECT,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BranchSlugTakenException();
      }
      throw error;
    }
  }

  async findExistingIds(
    tenantId: string,
    branchIds: readonly string[],
  ): Promise<readonly string[]> {
    if (branchIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.branch.findMany({
      where: { tenantId, id: { in: [...branchIds] } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
