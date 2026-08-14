import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { PublicRateLimitResolver } from './public-rate-limit.resolver';
import {
  LOGIN_RATE_LIMIT_MESSAGE,
  PUBLIC_RATE_LIMIT_MESSAGE,
  RateLimitExceededException,
} from './rate-limit.exception';
import { isLoginRequest, tenantSlugFromRequest } from './throttle-route.util';
import { PUBLIC_THROTTLER } from './throttling.constants';

/**
 * Primer APP_GUARD (docs/backend-architecture.md §3.2): rechaza abuso
 * antes de resolver tenant o JWT. Login por IP; menú/analytics por plan.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly publicRateLimits: PublicRateLimitResolver,
  ) {
    super(options, storage, reflector);
  }

  protected override async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.throttler.name !== PUBLIC_THROTTLER) {
      return super.handleRequest(requestProps);
    }

    const req = requestProps.context.switchToHttp().getRequest();
    const limit = await this.publicRateLimits.resolvePerMinute(
      tenantSlugFromRequest(req),
    );
    return super.handleRequest({ ...requestProps, limit });
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    _detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new RateLimitExceededException(
      isLoginRequest(context)
        ? LOGIN_RATE_LIMIT_MESSAGE
        : PUBLIC_RATE_LIMIT_MESSAGE,
    );
  }
}
