import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  readonly value: number | null;
  readonly expiresAt: number;
}

/**
 * Lee `Plan.rateLimitPerMinute` por slug de Tenant (features-spec.md §7.4).
 * Usa Prisma crudo: corre en ThrottlerGuard, antes de TenantContext.
 * Caché corta para no duplicar el lookup de TenantResolutionGuard en tráfico repetido.
 */
@Injectable()
export class PlanRateLimitRepository {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async findPerMinuteByTenantSlug(slug: string): Promise<number | null> {
    const now = Date.now();
    const hit = this.cache.get(slug);
    if (hit && hit.expiresAt > now) {
      return hit.value;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { plan: { select: { rateLimitPerMinute: true } } },
    });
    const raw = tenant?.plan?.rateLimitPerMinute;
    const value = typeof raw === 'number' && raw > 0 ? raw : null;
    this.cache.set(slug, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  }
}
