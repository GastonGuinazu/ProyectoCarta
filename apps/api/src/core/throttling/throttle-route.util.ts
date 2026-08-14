import type { ExecutionContext } from '@nestjs/common';

const LOGIN_PATH = /\/admin\/auth\/login\/?$/;
const PUBLIC_MENU_GET_PATH = /\/menu\/public\/[^/]+\/[^/]+\/?$/;
const PUBLIC_EVENTS_PATH = /\/menu\/public\/[^/]+\/[^/]+\/events\/?$/;

export interface ThrottleRequestShape {
  method?: string;
  path?: unknown;
  url?: unknown;
  ip?: unknown;
  ips?: unknown;
  params?: Record<string, unknown>;
}

export function requestPath(req: ThrottleRequestShape): string {
  if (typeof req.path === 'string' && req.path.length > 0) {
    return req.path;
  }
  if (typeof req.url === 'string' && req.url.length > 0) {
    const q = req.url.indexOf('?');
    return q === -1 ? req.url : req.url.slice(0, q);
  }
  return '';
}

export function isLoginPath(method: string, path: string): boolean {
  return method === 'POST' && LOGIN_PATH.test(path);
}

export function isPublicMenuGetPath(method: string, path: string): boolean {
  return method === 'GET' && PUBLIC_MENU_GET_PATH.test(path);
}

export function isPublicAnalyticsPath(method: string, path: string): boolean {
  return method === 'POST' && PUBLIC_EVENTS_PATH.test(path);
}

export function isLoginRequest(context: ExecutionContext): boolean {
  const req = context.switchToHttp().getRequest<ThrottleRequestShape>();
  return isLoginPath(req.method ?? '', requestPath(req));
}

export function isPublicThrottledRequest(context: ExecutionContext): boolean {
  const req = context.switchToHttp().getRequest<ThrottleRequestShape>();
  const method = req.method ?? '';
  const path = requestPath(req);
  return isPublicMenuGetPath(method, path) || isPublicAnalyticsPath(method, path);
}

export function tenantSlugFromRequest(req: ThrottleRequestShape): string | undefined {
  const fromParams = req.params?.tenantSlug;
  if (typeof fromParams === 'string' && fromParams.length > 0) {
    return fromParams;
  }
  const match = requestPath(req).match(/\/menu\/public\/([^/]+)\//);
  return match?.[1];
}

/**
 * IP del cliente detrás de Railway (`trust proxy` en main.ts).
 * No leemos `X-Forwarded-For` a mano: Express ya lo resolvió en `req.ip`.
 */
export function clientIp(req: ThrottleRequestShape): string {
  if (Array.isArray(req.ips) && typeof req.ips[0] === 'string' && req.ips[0].length > 0) {
    return req.ips[0];
  }
  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return req.ip;
  }
  return 'unknown';
}
