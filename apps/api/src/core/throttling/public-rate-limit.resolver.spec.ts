import { PublicRateLimitResolver } from './public-rate-limit.resolver';
import type { PlanRateLimitRepository } from './plan-rate-limit.repository';
import type { ConfigService } from '@nestjs/config';

describe('PublicRateLimitResolver', () => {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE') {
        return 60;
      }
      throw new Error(`unexpected key ${key}`);
    },
  } as unknown as ConfigService;

  it('uses Plan.rateLimitPerMinute when the slug resolves', async () => {
    const plans = {
      findPerMinuteByTenantSlug: jest.fn().mockResolvedValue(120),
    } as unknown as PlanRateLimitRepository;
    const resolver = new PublicRateLimitResolver(plans, config);

    await expect(resolver.resolvePerMinute('don-luigi')).resolves.toBe(120);
  });

  it('falls back when the tenant/plan is unknown', async () => {
    const plans = {
      findPerMinuteByTenantSlug: jest.fn().mockResolvedValue(null),
    } as unknown as PlanRateLimitRepository;
    const resolver = new PublicRateLimitResolver(plans, config);

    await expect(resolver.resolvePerMinute('missing')).resolves.toBe(60);
    await expect(resolver.resolvePerMinute(undefined)).resolves.toBe(60);
  });
});
