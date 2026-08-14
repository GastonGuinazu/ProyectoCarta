import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type PromoStatus } from '@prisma/client';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type {
  AdminPromoRecord,
  AdminPromoWriteInput,
} from '../admin-engagement.types';
import type { PromoRow } from './promo-row.type';

const ADMIN_PROMO_INCLUDE = {
  productTargets: { select: { productId: true } },
  categoryTargets: { select: { categoryId: true } },
  comboTargets: { select: { comboId: true } },
  branches: { select: { branchId: true } },
} as const;

/**
 * Única capa autorizada a hablar con Prisma para el modelo `Promo`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta `TENANT_PRISMA_CLIENT`
 * (Capa 2 de aislamiento), y pasa `tenantId` explícito en el `where`
 * (Capa 1).
 */
@Injectable()
export class PromoRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * "Vigente" se evalúa en tiempo real contra `now` (`startAt <= now <= endAt`),
   * NUNCA confiando en el campo `status` como única fuente de verdad
   * (features-spec.md §3.3). `status` solo se usa para excluir `CANCELLED`.
   */
  async findActiveForBranch(
    tenantId: string,
    branchId: string,
    now: Date,
  ): Promise<readonly PromoRow[]> {
    const promos = await this.prisma.promo.findMany({
      where: {
        tenantId,
        status: { not: 'CANCELLED' },
        startAt: { lte: now },
        endAt: { gte: now },
        OR: [
          { availableInAllBranches: true },
          { branches: { some: { branchId } } },
        ],
      },
      include: {
        productTargets: { select: { productId: true } },
        categoryTargets: { select: { categoryId: true } },
        comboTargets: { select: { comboId: true } },
      },
    });

    return promos.map((promo) => ({
      id: promo.id,
      name: promo.name as LocalizedText,
      discountType: promo.discountType,
      discountPercentageBp: promo.discountPercentageBp,
      discountAmountCents: promo.discountAmountCents,
      fixedPriceCents: promo.fixedPriceCents,
      priority: promo.priority,
      createdAt: promo.createdAt,
      productIds: promo.productTargets.map((target) => target.productId),
      categoryIds: promo.categoryTargets.map((target) => target.categoryId),
      comboIds: promo.comboTargets.map((target) => target.comboId),
    }));
  }

  async findAdminList(tenantId: string): Promise<readonly AdminPromoRecord[]> {
    const promos = await this.prisma.promo.findMany({
      where: { tenantId },
      include: ADMIN_PROMO_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return promos.map(toAdminPromoRecord);
  }

  async findAdminById(
    tenantId: string,
    promoId: string,
  ): Promise<AdminPromoRecord | null> {
    const promo = await this.prisma.promo.findFirst({
      where: { tenantId, id: promoId },
      include: ADMIN_PROMO_INCLUDE,
    });
    return promo ? toAdminPromoRecord(promo) : null;
  }

  async findAdminForProduct(
    tenantId: string,
    productId: string,
    categoryId: string,
  ): Promise<readonly AdminPromoRecord[]> {
    const promos = await this.prisma.promo.findMany({
      where: {
        tenantId,
        OR: [
          { productTargets: { some: { productId } } },
          { categoryTargets: { some: { categoryId } } },
        ],
      },
      include: ADMIN_PROMO_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return promos.map(toAdminPromoRecord);
  }

  async createAdmin(
    tenantId: string,
    input: AdminPromoWriteInput,
  ): Promise<AdminPromoRecord> {
    const promo = await this.prisma.promo.create({
      data: {
        tenantId,
        ...toPromoScalarData(input),
        ...toTargetCreates(tenantId, input),
      },
      include: ADMIN_PROMO_INCLUDE,
    });
    return toAdminPromoRecord(promo);
  }

  async updateAdmin(
    tenantId: string,
    promoId: string,
    input: AdminPromoWriteInput,
  ): Promise<AdminPromoRecord> {
    const promo = await this.prisma.$transaction(async (tx) => {
      await tx.promoProductTarget.deleteMany({ where: { tenantId, promoId } });
      await tx.promoCategoryTarget.deleteMany({ where: { tenantId, promoId } });
      await tx.promoComboTarget.deleteMany({ where: { tenantId, promoId } });
      await tx.promoBranch.deleteMany({ where: { tenantId, promoId } });
      return tx.promo.update({
        where: { id: promoId },
        data: {
          ...toPromoScalarData(input),
          ...toTargetCreates(tenantId, input),
        },
        include: ADMIN_PROMO_INCLUDE,
      });
    });
    return toAdminPromoRecord(promo);
  }

  async deleteAdmin(tenantId: string, promoId: string): Promise<void> {
    await this.prisma.promo.deleteMany({ where: { tenantId, id: promoId } });
  }
}

function toPromoScalarData(input: AdminPromoWriteInput) {
  return {
    name: input.name,
    description: input.description ?? Prisma.JsonNull,
    discountType: input.discountType,
    discountPercentageBp: input.discountPercentageBp,
    discountAmountCents: input.discountAmountCents,
    fixedPriceCents: input.fixedPriceCents,
    startAt: input.startAt,
    endAt: input.endAt,
    priority: input.priority,
    status: input.status,
    availableInAllBranches: input.availableInAllBranches,
  };
}

function toTargetCreates(
  tenantId: string,
  input: AdminOfferTargetSource,
): {
  productTargets: { create: { tenantId: string; productId: string }[] };
  categoryTargets: { create: { tenantId: string; categoryId: string }[] };
  comboTargets: { create: { tenantId: string; comboId: string }[] };
  branches: { create: { tenantId: string; branchId: string }[] };
} {
  return {
    productTargets: {
      create: input.productIds.map((productId) => ({ tenantId, productId })),
    },
    categoryTargets: {
      create: input.categoryIds.map((categoryId) => ({ tenantId, categoryId })),
    },
    comboTargets: {
      create: input.comboIds.map((comboId) => ({ tenantId, comboId })),
    },
    branches: {
      create: input.branchIds.map((branchId) => ({ tenantId, branchId })),
    },
  };
}

interface AdminOfferTargetSource {
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly comboIds: readonly string[];
  readonly branchIds: readonly string[];
}

function toAdminPromoRecord(promo: {
  id: string;
  name: unknown;
  description: unknown;
  discountType: AdminPromoRecord['discountType'];
  discountPercentageBp: number | null;
  discountAmountCents: number | null;
  fixedPriceCents: number | null;
  startAt: Date;
  endAt: Date;
  priority: number;
  status: PromoStatus;
  availableInAllBranches: boolean;
  createdAt: Date;
  productTargets: readonly { productId: string }[];
  categoryTargets: readonly { categoryId: string }[];
  comboTargets: readonly { comboId: string }[];
  branches: readonly { branchId: string }[];
}): AdminPromoRecord {
  return {
    id: promo.id,
    name: promo.name as LocalizedText,
    description: (promo.description as LocalizedText | null) ?? null,
    discountType: promo.discountType,
    discountPercentageBp: promo.discountPercentageBp,
    discountAmountCents: promo.discountAmountCents,
    fixedPriceCents: promo.fixedPriceCents,
    startAt: promo.startAt,
    endAt: promo.endAt,
    priority: promo.priority,
    status: promo.status,
    availableInAllBranches: promo.availableInAllBranches,
    productIds: promo.productTargets.map((target) => target.productId),
    categoryIds: promo.categoryTargets.map((target) => target.categoryId),
    comboIds: promo.comboTargets.map((target) => target.comboId),
    branchIds: promo.branches.map((branch) => branch.branchId),
    createdAt: promo.createdAt,
  };
}
