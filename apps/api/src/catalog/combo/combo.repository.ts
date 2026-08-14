import { Inject, Injectable } from '@nestjs/common';
import { AvailabilityStatus, Prisma } from '@prisma/client';
import {
  TENANT_PRISMA_CLIENT,
  type LocalizedText,
  type TenantScopedPrismaClient,
} from '../../core';
import type { ComboRow } from './combo-row.type';

export interface AdminComboItemWrite {
  readonly productId: string;
  readonly quantity: number;
}

export interface AdminComboWriteInput {
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly priceCents: number;
  readonly currency?: string;
  readonly availability: AvailabilityStatus;
  readonly items: readonly AdminComboItemWrite[];
}

export interface AdminComboPatchInput {
  readonly name?: LocalizedText;
  readonly description?: LocalizedText | null;
  readonly priceCents?: number;
  readonly currency?: string;
  readonly availability?: AvailabilityStatus;
  readonly items?: readonly AdminComboItemWrite[];
}

export interface AdminComboItemRecord {
  readonly productId: string;
  readonly quantity: number;
  readonly productName: LocalizedText;
}

export interface AdminComboRecord {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly priceCents: number;
  readonly currency: string;
  readonly availability: AvailabilityStatus;
  readonly imageMediaAssetId: string | null;
  readonly items: readonly AdminComboItemRecord[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const ADMIN_COMBO_INCLUDE = {
  items: {
    include: { product: { select: { name: true } } },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.ComboInclude;

/**
 * Única capa autorizada a hablar con Prisma para el modelo `Combo`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta `TENANT_PRISMA_CLIENT`
 * (Capa 2 de aislamiento), y pasa `tenantId` explícito en el `where`
 * (Capa 1, defensa en profundidad).
 */
@Injectable()
export class ComboRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * "Disponibles en la sucursal" combina dos condiciones independientes,
   * ambas seguras de aplicar a nivel de consulta (a diferencia de
   * `CategoryRepository`, un Combo no tiene hijos cuya visibilidad dependa de
   * él, así que no hay riesgo de "huérfanos" al filtrar acá):
   *
   * 1. Disponibilidad por sucursal: igual patrón que `Product`
   *    (`availableInAllBranches` OR existe una fila en `branchAvailabilities`
   *    para este `branchId`).
   * 2. Vigencia temporal: `startAt`/`endAt` son opcionales en el schema
   *    ("puede tener fecha de inicio/fin, similar a una Promo"). Un combo sin
   *    fecha en alguno de los dos extremos se considera abierto en ese
   *    extremo; si tiene fecha, exige que `now` esté dentro del rango.
   *
   * NO se filtra por `availability` (AVAILABLE/OUT_OF_STOCK/DISCONTINUED):
   * igual que en `ProductRepository`, ese estado se expone tal cual para que
   * el frontend decida cómo renderizarlo (ej. tachado), en vez de ocultarlo
   * silenciosamente en el backend.
   */
  async findAvailableForBranch(
    tenantId: string,
    branchId: string,
  ): Promise<readonly ComboRow[]> {
    const now = new Date();

    const combos = await this.prisma.combo.findMany({
      where: {
        tenantId,
        AND: [
          {
            OR: [
              { availableInAllBranches: true },
              { branchAvailabilities: { some: { branchId } } },
            ],
          },
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, slug: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return combos.map((combo) => ({
      id: combo.id,
      slug: combo.slug,
      name: combo.name as LocalizedText,
      description: combo.description as LocalizedText | null,
      priceCents: combo.priceCents,
      currency: combo.currency,
      imageMediaAssetId: combo.imageMediaAssetId,
      availability: combo.availability,
      items: combo.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          slug: item.product.slug,
          name: item.product.name as LocalizedText,
        },
      })),
    }));
  }

  async findAdminList(tenantId: string): Promise<readonly AdminComboRecord[]> {
    const combos = await this.prisma.combo.findMany({
      where: { tenantId },
      include: ADMIN_COMBO_INCLUDE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return combos.map(toAdminComboRecord);
  }

  async findAdminById(
    tenantId: string,
    comboId: string,
  ): Promise<AdminComboRecord | null> {
    const combo = await this.prisma.combo.findFirst({
      where: { tenantId, id: comboId },
      include: ADMIN_COMBO_INCLUDE,
    });
    return combo ? toAdminComboRecord(combo) : null;
  }

  async findIdBySlug(tenantId: string, slug: string): Promise<string | null> {
    const combo = await this.prisma.combo.findFirst({
      where: { tenantId, slug },
      select: { id: true },
    });
    return combo?.id ?? null;
  }

  async findExistingIds(
    tenantId: string,
    ids: readonly string[],
  ): Promise<readonly string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.prisma.combo.findMany({
      where: { tenantId, id: { in: [...ids] } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async createAdmin(
    tenantId: string,
    input: AdminComboWriteInput,
  ): Promise<AdminComboRecord> {
    const combo = await this.prisma.combo.create({
      data: {
        tenantId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? Prisma.JsonNull,
        priceCents: input.priceCents,
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        availability: input.availability,
        items: {
          create: input.items.map((item) => ({
            tenantId,
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: ADMIN_COMBO_INCLUDE,
    });
    return toAdminComboRecord(combo);
  }

  async updateAdmin(
    tenantId: string,
    comboId: string,
    patch: AdminComboPatchInput,
  ): Promise<AdminComboRecord> {
    const combo = await this.prisma.$transaction(async (tx) => {
      if (patch.items) {
        await tx.comboItem.deleteMany({ where: { tenantId, comboId } });
      }
      return tx.combo.update({
        where: { id: comboId, tenantId },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined
            ? { description: patch.description ?? Prisma.JsonNull }
            : {}),
          ...(patch.priceCents !== undefined
            ? { priceCents: patch.priceCents }
            : {}),
          ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
          ...(patch.availability !== undefined
            ? { availability: patch.availability }
            : {}),
          ...(patch.items
            ? {
                items: {
                  create: patch.items.map((item) => ({
                    tenantId,
                    productId: item.productId,
                    quantity: item.quantity,
                  })),
                },
              }
            : {}),
        },
        include: ADMIN_COMBO_INCLUDE,
      });
    });
    return toAdminComboRecord(combo);
  }

  async deleteAdmin(tenantId: string, comboId: string): Promise<void> {
    await this.prisma.combo.delete({
      where: { id: comboId, tenantId },
    });
  }
}

type AdminComboPayload = Prisma.ComboGetPayload<{
  include: typeof ADMIN_COMBO_INCLUDE;
}>;

function toAdminComboRecord(combo: AdminComboPayload): AdminComboRecord {
  return {
    id: combo.id,
    slug: combo.slug,
    name: combo.name as LocalizedText,
    description: combo.description as LocalizedText | null,
    priceCents: combo.priceCents,
    currency: combo.currency,
    availability: combo.availability,
    imageMediaAssetId: combo.imageMediaAssetId,
    items: combo.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      productName: item.product.name as LocalizedText,
    })),
    createdAt: combo.createdAt,
    updatedAt: combo.updatedAt,
  };
}
