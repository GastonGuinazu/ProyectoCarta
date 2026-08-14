import type { ConfigService } from '@nestjs/config';
import { seconds, type ThrottlerModuleOptions } from '@nestjs/throttler';
import {
  clientIp,
  isLoginRequest,
  isPublicThrottledRequest,
  tenantSlugFromRequest,
} from './throttle-route.util';
import {
  LOGIN_THROTTLER,
  PUBLIC_RATE_WINDOW_SECONDS,
  PUBLIC_THROTTLER,
} from './throttling.constants';

export function createThrottlerModuleOptions(
  config: ConfigService,
): ThrottlerModuleOptions {
  return {
    getTracker: (req, context) => {
      const ip = clientIp(req);
      if (isPublicThrottledRequest(context)) {
        return `${ip}:${tenantSlugFromRequest(req) ?? '_'}`;
      }
      return ip;
    },
    throttlers: [
      {
        name: LOGIN_THROTTLER,
        ttl: seconds(config.getOrThrow<number>('AUTH_LOGIN_RATE_TTL_SECONDS')),
        limit: config.getOrThrow<number>('AUTH_LOGIN_RATE_LIMIT'),
        skipIf: (context) => !isLoginRequest(context),
      },
      {
        name: PUBLIC_THROTTLER,
        ttl: seconds(PUBLIC_RATE_WINDOW_SECONDS),
        limit: config.getOrThrow<number>('PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE'),
        skipIf: (context) => !isPublicThrottledRequest(context),
      },
    ],
  };
}
