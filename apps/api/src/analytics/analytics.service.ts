import { Injectable } from '@nestjs/common';
import {
  AnalyticsEntityType,
  InteractionType,
} from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { TenantContextService, type LocalizedText } from '../core';
import { SettingsBranchNotFoundException } from '../tenant/settings/admin-settings.exceptions';
import { BranchService } from '../tenant/branch/branch.service';
import { AnalyticsRepository } from './analytics.repository';
import type {
  AnalyticsSummary,
  RecordPublicEventInput,
} from './analytics.types';
import {
  AR_DEDUPE_MS,
  FILTER_DEDUPE_MS,
  MAX_DWELL_MS,
  MAX_SEARCH_QUERY_LENGTH,
  SEARCH_DEDUPE_MS,
  STAYED_THRESHOLD_MS,
} from './analytics.types';

const SUMMARY_TOP = 8;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly catalogService: CatalogService,
    private readonly branchService: BranchService,
  ) {}

  async recordPublicEvent(input: RecordPublicEventInput): Promise<void> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const branchId = this.tenantContextService.getBranchId();
    if (!branchId) {
      return;
    }

    const occurredAt = new Date();
    switch (input.kind) {
      case 'scan':
        await this.analyticsRepository.createScan({
          tenantId,
          branchId,
          sessionId: input.sessionId,
          userAgent: truncate(input.userAgent, 180),
          deviceType: deviceTypeFromUserAgent(input.userAgent),
          occurredAt,
        });
        return;
      case 'search':
        await this.recordSearch(tenantId, branchId, input, occurredAt);
        return;
      case 'filter':
        await this.recordFilter(tenantId, branchId, input, occurredAt);
        return;
      case 'ar':
        await this.recordAr(tenantId, branchId, input, occurredAt);
        return;
      case 'dwell':
        await this.recordDwell(tenantId, branchId, input, occurredAt);
        return;
    }
  }

  async getSummary(periodDays: number): Promise<AnalyticsSummary> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const branchId =
      this.tenantContextService.getBranchId() ??
      (await this.branchService.findPrimaryId(tenantId));
    if (!branchId) {
      throw new SettingsBranchNotFoundException();
    }

    const from = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const [visits, dwells, searches, allergenRows, dietaryRows, arRows, catalogs] =
      await Promise.all([
        this.analyticsRepository.countScans(tenantId, branchId, from),
        this.analyticsRepository.listDwellDurations(tenantId, branchId, from),
        this.analyticsRepository.listSearchQueries(tenantId, branchId, from),
        this.analyticsRepository.countFiltersByEntity(
          tenantId,
          branchId,
          from,
          InteractionType.ALLERGEN_FILTER_APPLIED,
        ),
        this.analyticsRepository.countFiltersByEntity(
          tenantId,
          branchId,
          from,
          InteractionType.DIETARY_FILTER_APPLIED,
        ),
        this.analyticsRepository.countArByProduct(tenantId, branchId, from),
        this.catalogService.getPlatformCatalogs(),
      ]);

    const stayedCount = dwells.filter(
      (ms) => ms >= STAYED_THRESHOLD_MS,
    ).length;
    const dwellSum = dwells.reduce((sum, ms) => sum + ms, 0);
    const productIds = arRows.map((row) => row.productId);
    const productNames = await this.catalogService.findProductNames(productIds);
    const nameById = new Map(
      productNames.map((row) => [row.id, pickLabel(row.name)]),
    );

    const allergenNameById = new Map(
      catalogs.allergens.map((tag) => [tag.id, pickLabel(tag.name)]),
    );
    const dietaryNameById = new Map(
      catalogs.dietaryTags.map((tag) => [tag.id, pickLabel(tag.name)]),
    );

    return {
      periodDays,
      branchId,
      visits,
      stayedCount,
      averageDwellSeconds:
        dwells.length > 0 ? Math.round(dwellSum / dwells.length / 1000) : null,
      searches: topCounts(searches, SUMMARY_TOP),
      allergenFilters: allergenRows
        .map((row) => ({
          id: row.entityId,
          name: allergenNameById.get(row.entityId) ?? 'Alérgeno',
          count: row.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, SUMMARY_TOP),
      dietaryFilters: dietaryRows
        .map((row) => ({
          id: row.entityId,
          name: dietaryNameById.get(row.entityId) ?? 'Preferencia',
          count: row.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, SUMMARY_TOP),
      arViews: {
        total: arRows.reduce((sum, row) => sum + row.count, 0),
        products: [...arRows]
          .sort((a, b) => b.count - a.count)
          .slice(0, SUMMARY_TOP)
          .map((row) => ({
            id: row.productId,
            name: nameById.get(row.productId) ?? 'Plato',
            count: row.count,
          })),
      },
    };
  }

  private async recordSearch(
    tenantId: string,
    branchId: string,
    input: RecordPublicEventInput,
    occurredAt: Date,
  ): Promise<void> {
    const query = normalizeSearch(input.query);
    if (!query) {
      return;
    }
    const recent = await this.analyticsRepository.findRecentSearch({
      tenantId,
      branchId,
      sessionId: input.sessionId,
      query,
      since: new Date(Date.now() - SEARCH_DEDUPE_MS),
    });
    if (recent) {
      return;
    }
    await this.analyticsRepository.createInteraction({
      tenantId,
      branchId,
      sessionId: input.sessionId,
      interactionType: InteractionType.SEARCH_APPLIED,
      payload: { q: query },
      occurredAt,
    });
  }

  private async recordFilter(
    tenantId: string,
    branchId: string,
    input: RecordPublicEventInput,
    occurredAt: Date,
  ): Promise<void> {
    if (!input.tagId || !input.filterKind) {
      return;
    }
    const interactionType =
      input.filterKind === 'allergen'
        ? InteractionType.ALLERGEN_FILTER_APPLIED
        : InteractionType.DIETARY_FILTER_APPLIED;
    const recent = await this.analyticsRepository.findRecentInteraction({
      tenantId,
      branchId,
      sessionId: input.sessionId,
      interactionType,
      entityId: input.tagId,
      since: new Date(Date.now() - FILTER_DEDUPE_MS),
    });
    if (recent) {
      return;
    }
    await this.analyticsRepository.createInteraction({
      tenantId,
      branchId,
      sessionId: input.sessionId,
      interactionType,
      entityId: input.tagId,
      occurredAt,
    });
  }

  private async recordAr(
    tenantId: string,
    branchId: string,
    input: RecordPublicEventInput,
    occurredAt: Date,
  ): Promise<void> {
    if (!input.productId) {
      return;
    }
    const exists = await this.catalogService.productExists(input.productId);
    if (!exists) {
      return;
    }
    const recent = await this.analyticsRepository.findRecentInteraction({
      tenantId,
      branchId,
      sessionId: input.sessionId,
      interactionType: InteractionType.AR_VIEW_CLICK,
      entityId: input.productId,
      since: new Date(Date.now() - AR_DEDUPE_MS),
    });
    if (recent) {
      return;
    }
    await this.analyticsRepository.createInteraction({
      tenantId,
      branchId,
      sessionId: input.sessionId,
      interactionType: InteractionType.AR_VIEW_CLICK,
      entityType: AnalyticsEntityType.PRODUCT,
      entityId: input.productId,
      occurredAt,
    });
  }

  private async recordDwell(
    tenantId: string,
    branchId: string,
    input: RecordPublicEventInput,
    occurredAt: Date,
  ): Promise<void> {
    const durationMs = input.durationMs;
    if (durationMs === undefined || durationMs < 1 || durationMs > MAX_DWELL_MS) {
      return;
    }
    await this.analyticsRepository.upsertSessionDwell({
      tenantId,
      branchId,
      sessionId: input.sessionId,
      durationMs,
      occurredAt,
    });
  }
}

function normalizeSearch(query: string | undefined): string | null {
  if (!query) {
    return null;
  }
  const trimmed = query.trim().toLowerCase().slice(0, MAX_SEARCH_QUERY_LENGTH);
  return trimmed.length >= 2 ? trimmed : null;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, max);
}

function deviceTypeFromUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) {
    return null;
  }
  if (/tablet|ipad/i.test(userAgent)) {
    return 'tablet';
  }
  if (/mobi|android/i.test(userAgent)) {
    return 'mobile';
  }
  return 'desktop';
}

function pickLabel(name: LocalizedText): string {
  return name['es'] ?? Object.values(name)[0] ?? 'Sin nombre';
}

function topCounts(
  values: readonly string[],
  limit: number,
): readonly { readonly query: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query, count]) => ({ query, count }));
}
