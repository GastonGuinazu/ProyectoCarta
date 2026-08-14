import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanRateLimitRepository } from './plan-rate-limit.repository';

/**
 * Límite público por plan del tenant (features-spec.md §7.4).
 * Si el slug no resuelve un plan, usa `PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE`
 * para no dejar el GET/POST público sin tope.
 */
@Injectable()
export class PublicRateLimitResolver {
  constructor(
    private readonly plans: PlanRateLimitRepository,
    private readonly config: ConfigService,
  ) {}

  async resolvePerMinute(tenantSlug: string | undefined): Promise<number> {
    const fallback = this.config.getOrThrow<number>(
      'PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE',
    );
    if (!tenantSlug) {
      return fallback;
    }
    const fromPlan = await this.plans.findPerMinuteByTenantSlug(tenantSlug);
    return fromPlan ?? fallback;
  }
}
