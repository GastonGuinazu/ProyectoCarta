import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { TenantContextService } from '../core';
import { BranchService } from '../tenant/branch/branch.service';
import { ProductNotFoundException } from '../catalog/product/admin-product.exceptions';
import type { AdminProductOfferItem } from './admin-engagement.types';
import { isHappyHourActiveNow } from './branch-local-time.util';
import { derivePromoStatus } from './offer-write.util';
import { HappyHourRepository } from './happy-hour/happy-hour.repository';
import { PromoRepository } from './promo/promo.repository';
import {
  computeFinalPriceCents,
  pickWinningCandidate,
  type PromotionCandidate,
} from './promotion-candidate';

@Injectable()
export class AdminProductOffersService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly catalogService: CatalogService,
    private readonly branchService: BranchService,
    private readonly promoRepository: PromoRepository,
    private readonly happyHourRepository: HappyHourRepository,
  ) {}

  async listForProduct(
    productId: string,
  ): Promise<{ readonly items: readonly AdminProductOfferItem[] }> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const product = await this.catalogService.findProductOfferContext(productId);
    if (!product) {
      throw new ProductNotFoundException();
    }

    const now = new Date();
    const branchId = this.tenantContextService.getBranchId();
    const branch = branchId
      ? await this.branchService.getBranchDetails(branchId)
      : null;

    const [promos, happyHours] = await Promise.all([
      this.promoRepository.findAdminForProduct(
        tenantId,
        product.id,
        product.categoryId,
      ),
      this.happyHourRepository.findAdminForProduct(
        tenantId,
        product.id,
        product.categoryId,
      ),
    ]);

    const items: AdminProductOfferItem[] = [];
    const liveCandidates: PromotionCandidate[] = [];

    for (const promo of promos) {
      const status = derivePromoStatus(promo.startAt, promo.endAt, now);
      const appliesNow = status === 'ACTIVE';
      const scope = promo.productIds.includes(product.id)
        ? 'PRODUCT'
        : 'CATEGORY';
      const candidate: PromotionCandidate = {
        id: promo.id,
        kind: 'PROMO',
        name: promo.name,
        discountType: promo.discountType,
        discountPercentageBp: promo.discountPercentageBp,
        discountAmountCents: promo.discountAmountCents,
        fixedPriceCents: promo.fixedPriceCents,
        priority: promo.priority,
        createdAt: promo.createdAt,
        specificity: scope,
      };
      if (appliesNow) {
        liveCandidates.push(candidate);
      }
      items.push({
        kind: 'PROMO',
        id: promo.id,
        name: promo.name,
        scope,
        discountType: promo.discountType,
        discountPercentageBp: promo.discountPercentageBp,
        discountAmountCents: promo.discountAmountCents,
        fixedPriceCents: promo.fixedPriceCents,
        originalPrice: product.basePriceCents,
        finalPrice: computeFinalPriceCents(candidate, product.basePriceCents),
        currency: product.currency,
        appliesNow,
        isWinning: false,
        startAt: promo.startAt.toISOString(),
        endAt: promo.endAt.toISOString(),
        daysOfWeek: null,
        startMinuteOfDay: null,
        endMinuteOfDay: null,
        enabled: null,
        status,
      });
    }

    for (const happyHour of happyHours) {
      const appliesNow = Boolean(
        happyHour.enabled &&
          branch &&
          isHappyHourActiveNow(happyHour, branch.timezone, now),
      );
      const scope = happyHour.productIds.includes(product.id)
        ? 'PRODUCT'
        : 'CATEGORY';
      const candidate: PromotionCandidate = {
        id: happyHour.id,
        kind: 'HAPPY_HOUR',
        name: happyHour.name,
        discountType: happyHour.discountType,
        discountPercentageBp: happyHour.discountPercentageBp,
        discountAmountCents: happyHour.discountAmountCents,
        fixedPriceCents: happyHour.fixedPriceCents,
        priority: happyHour.priority,
        createdAt: happyHour.createdAt,
        specificity: scope,
      };
      if (appliesNow) {
        liveCandidates.push(candidate);
      }
      items.push({
        kind: 'HAPPY_HOUR',
        id: happyHour.id,
        name: happyHour.name,
        scope,
        discountType: happyHour.discountType,
        discountPercentageBp: happyHour.discountPercentageBp,
        discountAmountCents: happyHour.discountAmountCents,
        fixedPriceCents: happyHour.fixedPriceCents,
        originalPrice: product.basePriceCents,
        finalPrice: computeFinalPriceCents(candidate, product.basePriceCents),
        currency: product.currency,
        appliesNow,
        isWinning: false,
        startAt: null,
        endAt: null,
        daysOfWeek: happyHour.daysOfWeek,
        startMinuteOfDay: happyHour.startMinuteOfDay,
        endMinuteOfDay: happyHour.endMinuteOfDay,
        enabled: happyHour.enabled,
        status: null,
      });
    }

    const winner = pickWinningCandidate(liveCandidates);
    return {
      items: items.map((item) => ({
        ...item,
        isWinning: winner?.id === item.id && item.appliesNow,
      })),
    };
  }
}
