import { Injectable } from '@nestjs/common';
import { TenantContextService, TenantOrBranchNotFoundException } from '../core';
import { BranchService } from '../tenant/branch/branch.service';
import { isHappyHourActiveNow } from './branch-local-time.util';
import type { ActivePromotionsResolver } from './engagement.types';
import { HappyHourRepository } from './happy-hour/happy-hour.repository';
import type { HappyHourRow } from './happy-hour/happy-hour-row.type';
import { PromoRepository } from './promo/promo.repository';
import type { PromoRow } from './promo/promo-row.type';
import {
  pickWinningCandidate,
  toActivePromotionNode,
} from './promotion-candidate';
import type { PromotionCandidate } from './promotion-candidate';

/**
 * Lógica de negocio del dominio Engagement (docs/domain-modules.md §4,
 * docs/backend-architecture.md §2.1). Orquesta `PromoRepository` y
 * `HappyHourRepository`, evalúa qué Happy Hours están activos AHORA en la
 * timezone de la Sucursal, y resuelve qué promoción gana por entidad
 * (Producto/Combo) según prioridad -> especificidad -> recencia
 * (`promotion-candidate.ts`).
 *
 * Es, junto con `CatalogService`, uno de los únicos Services autorizados a
 * contener esta clase de resolución de reglas de negocio
 * (.cursor/rules/03-backend-nestjs.mdc: "Services... resolución de qué
 * promo/Happy Hour aplica"). `PublicMenuModule` (`MenuService` +
 * `apply-active-promotions.util.ts`) solo consume el resolver que este
 * método devuelve; no reimplementa ninguna de estas reglas.
 */
@Injectable()
export class EngagementService {
  constructor(
    private readonly promoRepository: PromoRepository,
    private readonly happyHourRepository: HappyHourRepository,
    private readonly branchService: BranchService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async getActivePromotionsForBranch(
    branchId: string,
  ): Promise<ActivePromotionsResolver> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();

    const branch = await this.branchService.getBranchDetails(branchId);
    if (!branch) {
      // Defensa en profundidad, mismo criterio que `MenuService.getPublicMenu`:
      // el Guard ya validó que la Sucursal existe antes de llegar acá.
      throw new TenantOrBranchNotFoundException();
    }

    const now = new Date();
    const [activePromos, enabledHappyHours] = await Promise.all([
      this.promoRepository.findActiveForBranch(tenantId, branchId, now),
      this.happyHourRepository.findEnabledForBranch(tenantId, branchId),
    ]);

    const activeHappyHours = enabledHappyHours.filter((happyHour) =>
      isHappyHourActiveNow(happyHour, branch.timezone, now),
    );

    const productCandidates = new Map<string, PromotionCandidate[]>();
    const categoryCandidates = new Map<string, PromotionCandidate[]>();
    const comboCandidates = new Map<string, PromotionCandidate[]>();

    for (const promo of activePromos) {
      indexCandidatesFromPromo(
        promo,
        productCandidates,
        categoryCandidates,
        comboCandidates,
      );
    }
    for (const happyHour of activeHappyHours) {
      indexCandidatesFromHappyHour(
        happyHour,
        productCandidates,
        categoryCandidates,
        comboCandidates,
      );
    }

    return {
      resolveForProduct: (productId, categoryId, basePriceCents) => {
        const candidates = [
          ...(productCandidates.get(productId) ?? []),
          ...(categoryCandidates.get(categoryId) ?? []),
        ];
        const winner = pickWinningCandidate(candidates);
        return winner ? toActivePromotionNode(winner, basePriceCents) : null;
      },
      resolveForCombo: (comboId, basePriceCents) => {
        const winner = pickWinningCandidate(comboCandidates.get(comboId) ?? []);
        return winner ? toActivePromotionNode(winner, basePriceCents) : null;
      },
    };
  }
}

function indexCandidatesFromPromo(
  promo: PromoRow,
  productCandidates: Map<string, PromotionCandidate[]>,
  categoryCandidates: Map<string, PromotionCandidate[]>,
  comboCandidates: Map<string, PromotionCandidate[]>,
): void {
  const base: Omit<PromotionCandidate, 'specificity'> = {
    id: promo.id,
    kind: 'PROMO',
    name: promo.name,
    discountType: promo.discountType,
    discountPercentageBp: promo.discountPercentageBp,
    discountAmountCents: promo.discountAmountCents,
    fixedPriceCents: promo.fixedPriceCents,
    priority: promo.priority,
    createdAt: promo.createdAt,
  };

  addCandidate(productCandidates, promo.productIds, {
    ...base,
    specificity: 'PRODUCT',
  });
  addCandidate(categoryCandidates, promo.categoryIds, {
    ...base,
    specificity: 'CATEGORY',
  });
  addCandidate(comboCandidates, promo.comboIds, {
    ...base,
    specificity: 'COMBO',
  });
}

function indexCandidatesFromHappyHour(
  happyHour: HappyHourRow,
  productCandidates: Map<string, PromotionCandidate[]>,
  categoryCandidates: Map<string, PromotionCandidate[]>,
  comboCandidates: Map<string, PromotionCandidate[]>,
): void {
  const base: Omit<PromotionCandidate, 'specificity'> = {
    id: happyHour.id,
    kind: 'HAPPY_HOUR',
    name: happyHour.name,
    discountType: happyHour.discountType,
    discountPercentageBp: happyHour.discountPercentageBp,
    discountAmountCents: happyHour.discountAmountCents,
    fixedPriceCents: happyHour.fixedPriceCents,
    priority: happyHour.priority,
    createdAt: happyHour.createdAt,
  };

  addCandidate(productCandidates, happyHour.productIds, {
    ...base,
    specificity: 'PRODUCT',
  });
  addCandidate(categoryCandidates, happyHour.categoryIds, {
    ...base,
    specificity: 'CATEGORY',
  });
  addCandidate(comboCandidates, happyHour.comboIds, {
    ...base,
    specificity: 'COMBO',
  });
}

function addCandidate(
  map: Map<string, PromotionCandidate[]>,
  ids: readonly string[],
  candidate: PromotionCandidate,
): void {
  for (const id of ids) {
    const existing = map.get(id);
    if (existing) {
      existing.push(candidate);
    } else {
      map.set(id, [candidate]);
    }
  }
}
