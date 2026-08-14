import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core';
import type {
  AdminBranchSettings,
  DetachedMediaRef,
  PublicTenantBranding,
} from './settings/admin-settings.types';

export interface TenantCatalogLimits {
  readonly id: string;
  readonly defaultLanguage: string;
  readonly maxProducts: number;
  readonly maxStorageMb: number;
  readonly maxBranches: number;
}

/**
 * Lectura de Tenant/Plan para límites de catálogo y settings de marca.
 * `Tenant` no es tenant-scoped: usa `PrismaService` crudo (misma excepción
 * que resolver por slug). Toda query de `MediaAsset` filtra `tenantId`.
 */
@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCatalogLimits(
    tenantId: string,
  ): Promise<TenantCatalogLimits | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        defaultLanguage: true,
        plan: {
          select: {
            maxProducts: true,
            maxStorageMb: true,
            maxBranches: true,
          },
        },
      },
    });
    if (!tenant) {
      return null;
    }
    return {
      id: tenant.id,
      defaultLanguage: tenant.defaultLanguage,
      maxProducts: tenant.plan.maxProducts,
      maxStorageMb: tenant.plan.maxStorageMb,
      maxBranches: tenant.plan.maxBranches,
    };
  }

  async findPublicBranding(
    tenantId: string,
  ): Promise<PublicTenantBranding | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        brandPrimaryColor: true,
        logoMediaAsset: { select: { originalUrl: true, tenantId: true } },
      },
    });
    if (!tenant) {
      return null;
    }
    const logoUrl =
      tenant.logoMediaAsset && tenant.logoMediaAsset.tenantId === tenantId
        ? tenant.logoMediaAsset.originalUrl
        : null;
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      branding: {
        primaryColor: tenant.brandPrimaryColor,
        logoUrl,
      },
    };
  }

  async findAdminSettings(
    tenantId: string,
    branchId?: string | null,
  ): Promise<AdminBranchSettings | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        brandPrimaryColor: true,
        logoMediaAsset: { select: { originalUrl: true, tenantId: true } },
        branches: {
          where: branchId ? { id: branchId } : undefined,
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            id: true,
            slug: true,
            address: true,
            phone: true,
            whatsapp: true,
            instagram: true,
            operationalStatus: true,
            timezone: true,
            bannerMediaAsset: { select: { originalUrl: true, tenantId: true } },
          },
        },
      },
    });
    const branch = tenant?.branches[0];
    if (!tenant || !branch) {
      return null;
    }
    return {
      branchId: branch.id,
      tenantSlug: tenant.slug,
      branchSlug: branch.slug,
      commercialName: tenant.name,
      phone: branch.phone,
      whatsapp: branch.whatsapp,
      instagram: branch.instagram,
      address: branch.address,
      accentColor: tenant.brandPrimaryColor,
      logoUrl:
        tenant.logoMediaAsset && tenant.logoMediaAsset.tenantId === tenantId
          ? tenant.logoMediaAsset.originalUrl
          : null,
      bannerUrl:
        branch.bannerMediaAsset &&
        branch.bannerMediaAsset.tenantId === tenantId
          ? branch.bannerMediaAsset.originalUrl
          : null,
      operationalStatus: branch.operationalStatus,
      timezone: branch.timezone,
    };
  }

  async updateBrandFields(
    tenantId: string,
    data: {
      readonly name?: string;
      readonly brandPrimaryColor?: string | null;
    },
  ): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.brandPrimaryColor !== undefined
          ? { brandPrimaryColor: data.brandPrimaryColor }
          : {}),
      },
    });
  }

  async attachLogo(
    tenantId: string,
    mediaAssetId: string,
  ): Promise<DetachedMediaRef | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        logoMediaAssetId: true,
        logoMediaAsset: { select: { id: true, originalUrl: true } },
      },
    });
    if (!tenant) {
      return null;
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoMediaAssetId: mediaAssetId },
    });
    if (
      !tenant.logoMediaAssetId ||
      tenant.logoMediaAssetId === mediaAssetId ||
      !tenant.logoMediaAsset
    ) {
      return null;
    }
    return {
      id: tenant.logoMediaAsset.id,
      originalUrl: tenant.logoMediaAsset.originalUrl,
    };
  }

  async detachLogo(tenantId: string): Promise<DetachedMediaRef | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        logoMediaAssetId: true,
        logoMediaAsset: { select: { id: true, originalUrl: true } },
      },
    });
    if (!tenant?.logoMediaAsset) {
      return null;
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoMediaAssetId: null },
    });
    return {
      id: tenant.logoMediaAsset.id,
      originalUrl: tenant.logoMediaAsset.originalUrl,
    };
  }
}
