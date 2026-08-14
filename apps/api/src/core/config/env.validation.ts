const MIN_PRODUCTION_SECRET_LENGTH = 32;

const WEAK_SECRETS = new Set([
  'cambiar-por-un-secreto-largo-y-aleatorio',
  'cambiar-por-otro-secreto-distinto-al-jwt',
  'changeme',
  'secret',
  'jwt_secret',
  'pepper',
]);

export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Tenant-Id',
  'X-Branch-Id',
] as const;

export const CORS_ALLOWED_METHODS = [
  'GET',
  'HEAD',
  'PUT',
  'PATCH',
  'POST',
  'DELETE',
  'OPTIONS',
] as const;

export interface ValidatedEnv {
  readonly PUBLIC_WEB_ORIGINS: readonly string[];
  readonly JWT_SECRET: string;
  readonly AUTH_PEPPER: string;
  readonly AUTH_COOKIE_SECURE: 'true' | 'false';
  readonly AUTH_LOGIN_RATE_LIMIT: number;
  readonly AUTH_LOGIN_RATE_TTL_SECONDS: number;
  readonly PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE: number;
}

const SUPABASE_TRANSACTION_POOLER_PORT = '6543';

/**
 * Valida al arranque la config que hoy rompería producción
 * (docs/produccion-checklist.md §2–3, docs/hosting.md).
 *
 * En producción (Railway, `NODE_ENV=production`): CORS https del front en
 * Vercel, cookies Secure, JWT_SECRET y AUTH_PEPPER largos y distintos.
 * Esos secretos no van a Vercel. Los topes de login/fallback público salen
 * de env; el menú usa `Plan.rateLimitPerMinute` en Postgres.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> & ValidatedEnv {
  const isProduction = readString(config.NODE_ENV) === 'production';
  const origins = parseCorsOrigins(
    readString(config.PUBLIC_WEB_ORIGIN),
    isProduction,
  );
  const jwtSecret = readRequiredSecret(config.JWT_SECRET, 'JWT_SECRET');
  const authPepper = readRequiredSecret(config.AUTH_PEPPER, 'AUTH_PEPPER');
  assertDistinctSecrets(jwtSecret, authPepper);
  assertDirectUrl(readString(config.DIRECT_URL), isProduction);
  if (isProduction) {
    assertProductionSecret('JWT_SECRET', jwtSecret);
    assertProductionSecret('AUTH_PEPPER', authPepper);
  }

  return {
    ...config,
    PUBLIC_WEB_ORIGINS: origins,
    JWT_SECRET: jwtSecret,
    AUTH_PEPPER: authPepper,
    AUTH_COOKIE_SECURE: parseCookieSecure(
      readString(config.AUTH_COOKIE_SECURE),
      isProduction,
    ),
    AUTH_LOGIN_RATE_LIMIT: parsePositiveInt(
      readString(config.AUTH_LOGIN_RATE_LIMIT),
      'AUTH_LOGIN_RATE_LIMIT',
      5,
    ),
    AUTH_LOGIN_RATE_TTL_SECONDS: parsePositiveInt(
      readString(config.AUTH_LOGIN_RATE_TTL_SECONDS),
      'AUTH_LOGIN_RATE_TTL_SECONDS',
      60,
    ),
    PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE: parsePositiveInt(
      readString(config.PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE),
      'PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE',
      60,
    ),
  };
}

export function parseCorsOrigins(
  raw: string | undefined,
  isProduction: boolean,
): string[] {
  if (!raw) {
    throw new Error(
      'PUBLIC_WEB_ORIGIN is required (comma-separated allowlist of the Angular origin on Vercel)',
    );
  }

  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error(
      'PUBLIC_WEB_ORIGIN is required (comma-separated allowlist of the Angular origin on Vercel)',
    );
  }

  const origins = parts.map((part) => parseOneOrigin(part, isProduction));
  return [...new Set(origins)];
}

function parseOneOrigin(value: string, isProduction: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`PUBLIC_WEB_ORIGIN contains an invalid origin: ${value}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`PUBLIC_WEB_ORIGIN must be http or https: ${value}`);
  }
  if (isProduction && url.protocol !== 'https:') {
    throw new Error(
      `PUBLIC_WEB_ORIGIN must use https in production (Vercel), got: ${value}`,
    );
  }
  if (url.username || url.password) {
    throw new Error(`PUBLIC_WEB_ORIGIN must not include credentials: ${value}`);
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      `PUBLIC_WEB_ORIGIN must be an origin without path, query or hash: ${value}`,
    );
  }

  return url.origin;
}

export function usesSupabaseTransactionPooler(connectionUrl: string): boolean {
  try {
    return new URL(connectionUrl).port === SUPABASE_TRANSACTION_POOLER_PORT;
  } catch {
    return false;
  }
}

function assertDirectUrl(
  raw: string | undefined,
  isProduction: boolean,
): void {
  if (!raw) {
    if (isProduction) {
      throw new Error(
        'DIRECT_URL is required in production (Postgres 5432, not the pooler 6543)',
      );
    }
    return;
  }

  try {
    new URL(raw);
  } catch {
    throw new Error('DIRECT_URL must be a valid URL');
  }
  if (usesSupabaseTransactionPooler(raw)) {
    throw new Error(
      'DIRECT_URL must not use the Supabase pooler port 6543; use 5432 (docs/hosting.md)',
    );
  }
}

function parseCookieSecure(
  raw: string | undefined,
  isProduction: boolean,
): 'true' | 'false' {
  if (isProduction) {
    if (raw !== 'true') {
      throw new Error(
        'AUTH_COOKIE_SECURE must be true in production (HTTPS cookies on api.proyectocarta.com)',
      );
    }
    return 'true';
  }

  if (raw === undefined || raw === '' || raw === 'false') {
    return 'false';
  }
  if (raw === 'true') {
    return 'true';
  }
  throw new Error('AUTH_COOKIE_SECURE must be "true" or "false"');
}

function readRequiredSecret(value: unknown, name: string): string {
  const secret = readString(value);
  if (!secret) {
    throw new Error(`${name} is required`);
  }
  return secret;
}

function assertProductionSecret(name: string, secret: string): void {
  if (secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
    );
  }
  if (WEAK_SECRETS.has(secret)) {
    throw new Error(
      `${name} is a published placeholder; set a random value only on the API host (Railway)`,
    );
  }
}

function assertDistinctSecrets(jwtSecret: string, authPepper: string): void {
  if (jwtSecret === authPepper) {
    throw new Error('JWT_SECRET and AUTH_PEPPER must be different values');
  }
}

function parsePositiveInt(
  raw: string | undefined,
  name: string,
  fallback: number,
): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== raw) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
