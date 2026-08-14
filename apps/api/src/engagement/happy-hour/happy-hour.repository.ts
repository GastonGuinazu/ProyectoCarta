import { Inject, Injectable } from '@nestjs/common';
import type { DayOfWeek } from '@prisma/client';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type {
  AdminHappyHourRecord,
  AdminHappyHourWriteInput,
} from '../admin-engagement.types';
import type { HappyHourRow } from './happy-hour-row.type';

const ADMIN_HAPPY_HOUR_INCLUDE = {
  productTargets: { select: { productId: true } },
  categoryTargets: { select: { categoryId: true } },
  comboTargets: { select: { comboId: true } },
  branches: { select: { branchId: true } },
} as const;

/**
 * Única capa autorizada a hablar con Prisma para el modelo `HappyHour`
 * (.cursor/rules/03-backend-nestjs.mdc).
 */
@Injectable()
export class HappyHourRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  async findEnabledForBranch(
    tenantId: string,
    branchId: string,
  ): Promise<readonly HappyHourRow[]> {
    const happyHours = await this.prisma.happyHour.findMany({
      where: {
        tenantId,
        enabled: true,
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

    return happyHours.map((happyHour) => ({
      id: happyHour.id,
      name: happyHour.name as LocalizedText,
      discountType: happyHour.discountType,
      discountPercentageBp: happyHour.discountPercentageBp,
      discountAmountCents: happyHour.discountAmountCents,
      fixedPriceCents: happyHour.fixedPriceCents,
      daysOfWeek: happyHour.daysOfWeek,
      startMinuteOfDay: happyHour.startMinuteOfDay,
      endMinuteOfDay: happyHour.endMinuteOfDay,
      priority: happyHour.priority,
      createdAt: happyHour.createdAt,
      productIds: happyHour.productTargets.map((target) => target.productId),
      categoryIds: happyHour.categoryTargets.map((target) => target.categoryId),
      comboIds: happyHour.comboTargets.map((target) => target.comboId),
    }));
  }

  async findAdminList(
    tenantId: string,
  ): Promise<readonly AdminHappyHourRecord[]> {
    const rows = await this.prisma.happyHour.findMany({
      where: { tenantId },
      include: ADMIN_HAPPY_HOUR_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toAdminHappyHourRecord);
  }

  async findAdminById(
    tenantId: string,
    happyHourId: string,
  ): Promise<AdminHappyHourRecord | null> {
    const row = await this.prisma.happyHour.findFirst({
      where: { tenantId, id: happyHourId },
      include: ADMIN_HAPPY_HOUR_INCLUDE,
    });
    return row ? toAdminHappyHourRecord(row) : null;
  }

  async findAdminForProduct(
    tenantId: string,
    productId: string,
    categoryId: string,
  ): Promise<readonly AdminHappyHourRecord[]> {
    const rows = await this.prisma.happyHour.findMany({
      where: {
        tenantId,
        OR: [
          { productTargets: { some: { productId } } },
          { categoryTargets: { some: { categoryId } } },
        ],
      },
      include: ADMIN_HAPPY_HOUR_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toAdminHappyHourRecord);
  }

  async createAdmin(
    tenantId: string,
    input: AdminHappyHourWriteInput,
  ): Promise<AdminHappyHourRecord> {
    const row = await this.prisma.happyHour.create({
      data: {
        tenantId,
        ...toHappyHourScalarData(input),
        ...toTargetCreates(tenantId, input),
      },
      include: ADMIN_HAPPY_HOUR_INCLUDE,
    });
    return toAdminHappyHourRecord(row);
  }

  async updateAdmin(
    tenantId: string,
    happyHourId: string,
    input: AdminHappyHourWriteInput,
  ): Promise<AdminHappyHourRecord> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.happyHourProductTarget.deleteMany({
        where: { tenantId, happyHourId },
      });
      await tx.happyHourCategoryTarget.deleteMany({
        where: { tenantId, happyHourId },
      });
      await tx.happyHourComboTarget.deleteMany({
        where: { tenantId, happyHourId },
      });
      await tx.happyHourBranch.deleteMany({
        where: { tenantId, happyHourId },
      });
      return tx.happyHour.update({
        where: { id: happyHourId },
        data: {
          ...toHappyHourScalarData(input),
          ...toTargetCreates(tenantId, input),
        },
        include: ADMIN_HAPPY_HOUR_INCLUDE,
      });
    });
    return toAdminHappyHourRecord(row);
  }

  async deleteAdmin(tenantId: string, happyHourId: string): Promise<void> {
    await this.prisma.happyHour.deleteMany({
      where: { tenantId, id: happyHourId },
    });
  }
}

function toHappyHourScalarData(input: AdminHappyHourWriteInput): {
  name: LocalizedText;
  discountType: AdminHappyHourWriteInput['discountType'];
  discountPercentageBp: number | null;
  discountAmountCents: number | null;
  fixedPriceCents: number | null;
  daysOfWeek: DayOfWeek[];
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  priority: number;
  enabled: boolean;
  availableInAllBranches: boolean;
} {
  return {
    name: input.name,
    discountType: input.discountType,
    discountPercentageBp: input.discountPercentageBp,
    discountAmountCents: input.discountAmountCents,
    fixedPriceCents: input.fixedPriceCents,
    daysOfWeek: [...input.daysOfWeek],
    startMinuteOfDay: input.startMinuteOfDay,
    endMinuteOfDay: input.endMinuteOfDay,
    priority: input.priority,
    enabled: input.enabled,
    availableInAllBranches: input.availableInAllBranches,
  };
}

function toTargetCreates(
  tenantId: string,
  input: {
    readonly productIds: readonly string[];
    readonly categoryIds: readonly string[];
    readonly comboIds: readonly string[];
    readonly branchIds: readonly string[];
  },
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

function toAdminHappyHourRecord(row: {
  id: string;
  name: unknown;
  discountType: AdminHappyHourRecord['discountType'];
  discountPercentageBp: number | null;
  discountAmountCents: number | null;
  fixedPriceCents: number | null;
  daysOfWeek: DayOfWeek[];
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  priority: number;
  enabled: boolean;
  availableInAllBranches: boolean;
  createdAt: Date;
  productTargets: readonly { productId: string }[];
  categoryTargets: readonly { categoryId: string }[];
  comboTargets: readonly { comboId: string }[];
  branches: readonly { branchId: string }[];
}): AdminHappyHourRecord {
  return {
    id: row.id,
    name: row.name as LocalizedText,
    discountType: row.discountType,
    discountPercentageBp: row.discountPercentageBp,
    discountAmountCents: row.discountAmountCents,
    fixedPriceCents: row.fixedPriceCents,
    daysOfWeek: row.daysOfWeek,
    startMinuteOfDay: row.startMinuteOfDay,
    endMinuteOfDay: row.endMinuteOfDay,
    priority: row.priority,
    enabled: row.enabled,
    availableInAllBranches: row.availableInAllBranches,
    productIds: row.productTargets.map((target) => target.productId),
    categoryIds: row.categoryTargets.map((target) => target.categoryId),
    comboIds: row.comboTargets.map((target) => target.comboId),
    branchIds: row.branches.map((branch) => branch.branchId),
    createdAt: row.createdAt,
  };
}
