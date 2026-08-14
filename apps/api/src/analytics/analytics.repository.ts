import { Inject, Injectable } from '@nestjs/common';
import {
  AnalyticsEntityType,
  InteractionType,
  Prisma,
} from '@prisma/client';
import {
  TENANT_PRISMA_CLIENT,
  type TenantScopedPrismaClient,
} from '../core';

@Injectable()
export class AnalyticsRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  async createScan(input: {
    readonly tenantId: string;
    readonly branchId: string;
    readonly sessionId: string;
    readonly userAgent: string | null;
    readonly deviceType: string | null;
    readonly occurredAt: Date;
  }): Promise<void> {
    try {
      await this.prisma.scanEvent.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          sessionId: input.sessionId,
          userAgent: input.userAgent,
          deviceType: input.deviceType,
          occurredAt: input.occurredAt,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }
  }

  async findRecentInteraction(input: {
    readonly tenantId: string;
    readonly branchId: string;
    readonly sessionId: string;
    readonly interactionType: InteractionType;
    readonly entityId: string | null;
    readonly since: Date;
  }): Promise<boolean> {
    const row = await this.prisma.interactionEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sessionId: input.sessionId,
        interactionType: input.interactionType,
        ...(input.entityId ? { entityId: input.entityId } : {}),
        occurredAt: { gte: input.since },
      },
      select: { id: true },
    });
    return row !== null;
  }

  async findRecentSearch(input: {
    readonly tenantId: string;
    readonly branchId: string;
    readonly sessionId: string;
    readonly query: string;
    readonly since: Date;
  }): Promise<boolean> {
    const row = await this.prisma.interactionEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sessionId: input.sessionId,
        interactionType: InteractionType.SEARCH_APPLIED,
        occurredAt: { gte: input.since },
        payload: { equals: { q: input.query } },
      },
      select: { id: true },
    });
    return row !== null;
  }

  async createInteraction(input: {
    readonly tenantId: string;
    readonly branchId: string;
    readonly sessionId: string;
    readonly interactionType: InteractionType;
    readonly entityType?: AnalyticsEntityType | null;
    readonly entityId?: string | null;
    readonly viewDurationMs?: number | null;
    readonly payload?: Prisma.InputJsonValue | null;
    readonly occurredAt: Date;
  }): Promise<void> {
    await this.prisma.interactionEvent.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sessionId: input.sessionId,
        interactionType: input.interactionType,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        viewDurationMs: input.viewDurationMs ?? null,
        payload: input.payload ?? Prisma.JsonNull,
        occurredAt: input.occurredAt,
      },
    });
  }

  async upsertSessionDwell(input: {
    readonly tenantId: string;
    readonly branchId: string;
    readonly sessionId: string;
    readonly durationMs: number;
    readonly occurredAt: Date;
  }): Promise<void> {
    const existing = await this.prisma.interactionEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        sessionId: input.sessionId,
        interactionType: InteractionType.SESSION_DWELL,
      },
      select: { id: true, viewDurationMs: true },
    });
    if (!existing) {
      await this.createInteraction({
        tenantId: input.tenantId,
        branchId: input.branchId,
        sessionId: input.sessionId,
        interactionType: InteractionType.SESSION_DWELL,
        viewDurationMs: input.durationMs,
        occurredAt: input.occurredAt,
      });
      return;
    }
    if ((existing.viewDurationMs ?? 0) >= input.durationMs) {
      return;
    }
    await this.prisma.interactionEvent.updateMany({
      where: { tenantId: input.tenantId, id: existing.id },
      data: {
        viewDurationMs: input.durationMs,
        occurredAt: input.occurredAt,
      },
    });
  }

  async countScans(
    tenantId: string,
    branchId: string,
    from: Date,
  ): Promise<number> {
    return this.prisma.scanEvent.count({
      where: { tenantId, branchId, occurredAt: { gte: from } },
    });
  }

  async listDwellDurations(
    tenantId: string,
    branchId: string,
    from: Date,
  ): Promise<readonly number[]> {
    const rows = await this.prisma.interactionEvent.findMany({
      where: {
        tenantId,
        branchId,
        interactionType: InteractionType.SESSION_DWELL,
        occurredAt: { gte: from },
        viewDurationMs: { not: null },
      },
      select: { viewDurationMs: true },
    });
    return rows.map((row) => row.viewDurationMs ?? 0);
  }

  async listSearchQueries(
    tenantId: string,
    branchId: string,
    from: Date,
  ): Promise<readonly string[]> {
    const rows = await this.prisma.interactionEvent.findMany({
      where: {
        tenantId,
        branchId,
        interactionType: InteractionType.SEARCH_APPLIED,
        occurredAt: { gte: from },
      },
      select: { payload: true },
    });
    const queries: string[] = [];
    for (const row of rows) {
      const query = readPayloadQuery(row.payload);
      if (query) {
        queries.push(query);
      }
    }
    return queries;
  }

  async countFiltersByEntity(
    tenantId: string,
    branchId: string,
    from: Date,
    interactionType:
      | typeof InteractionType.ALLERGEN_FILTER_APPLIED
      | typeof InteractionType.DIETARY_FILTER_APPLIED,
  ): Promise<readonly { readonly entityId: string; readonly count: number }[]> {
    const rows = await this.prisma.interactionEvent.groupBy({
      by: ['entityId'],
      where: {
        tenantId,
        branchId,
        interactionType,
        occurredAt: { gte: from },
        entityId: { not: null },
      },
      _count: { _all: true },
    });
    return rows
      .filter((row) => row.entityId)
      .map((row) => ({
        entityId: row.entityId as string,
        count: row._count._all,
      }));
  }

  async countArByProduct(
    tenantId: string,
    branchId: string,
    from: Date,
  ): Promise<readonly { readonly productId: string; readonly count: number }[]> {
    const rows = await this.prisma.interactionEvent.groupBy({
      by: ['entityId'],
      where: {
        tenantId,
        branchId,
        interactionType: InteractionType.AR_VIEW_CLICK,
        occurredAt: { gte: from },
        entityId: { not: null },
      },
      _count: { _all: true },
    });
    return rows
      .filter((row) => row.entityId)
      .map((row) => ({
        productId: row.entityId as string,
        count: row._count._all,
      }));
  }
}

function readPayloadQuery(payload: Prisma.JsonValue): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const query = (payload as { q?: unknown }).q;
  return typeof query === 'string' && query.trim() ? query.trim() : null;
}

