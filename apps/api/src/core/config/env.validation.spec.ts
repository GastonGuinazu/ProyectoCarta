import { parseCorsOrigins, isDevLanWebOrigin, usesSupabaseTransactionPooler, validateEnv } from './env.validation';

const DEV_ENV = {
  NODE_ENV: 'development',
  PUBLIC_WEB_ORIGIN: 'http://localhost:4200',
  JWT_SECRET: 'cambiar-por-un-secreto-largo-y-aleatorio',
  AUTH_PEPPER: 'cambiar-por-otro-secreto-distinto-al-jwt',
  AUTH_COOKIE_SECURE: 'false',
};

const PROD_ENV = {
  NODE_ENV: 'production',
  PUBLIC_WEB_ORIGIN:
    'https://proyectocarta.com, https://www.proyectocarta.com',
  JWT_SECRET: 'p'.repeat(16) + 'jwt-production-secret-value',
  AUTH_PEPPER: 'q'.repeat(16) + 'pepper-production-secret-value',
  AUTH_COOKIE_SECURE: 'true',
  DATABASE_URL: 'postgresql://example',
  DIRECT_URL:
    'postgresql://postgres.xxxx:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
};

describe('parseCorsOrigins', () => {
  it('parses a comma-separated allowlist and drops duplicates', () => {
    expect(
      parseCorsOrigins(
        'https://proyectocarta.com, https://www.proyectocarta.com, https://proyectocarta.com',
        true,
      ),
    ).toEqual(['https://proyectocarta.com', 'https://www.proyectocarta.com']);
  });

  it('rejects a path on the origin', () => {
    expect(() =>
      parseCorsOrigins('https://proyectocarta.com/admin', true),
    ).toThrow(/without path/);
  });

  it('rejects http in production', () => {
    expect(() => parseCorsOrigins('http://localhost:4200', true)).toThrow(
      /https/,
    );
  });

  it('allows http localhost outside production', () => {
    expect(parseCorsOrigins('http://localhost:4200', false)).toEqual([
      'http://localhost:4200',
    ]);
  });
});

describe('isDevLanWebOrigin', () => {
  it('accepts the phone origin on the LAN Angular port', () => {
    expect(isDevLanWebOrigin('http://192.168.88.20:4200')).toBe(true);
    expect(isDevLanWebOrigin('http://10.0.0.5:4200')).toBe(true);
    expect(isDevLanWebOrigin('http://172.16.1.2:4200')).toBe(true);
  });

  it('rejects production-like and non-dev ports', () => {
    expect(isDevLanWebOrigin('https://proyecto-carta-web.vercel.app')).toBe(
      false,
    );
    expect(isDevLanWebOrigin('http://192.168.88.20:3000')).toBe(false);
    expect(isDevLanWebOrigin('http://8.8.8.8:4200')).toBe(false);
  });
});

describe('validateEnv', () => {
  it('keeps other env vars and exposes PUBLIC_WEB_ORIGINS', () => {
    const validated = validateEnv(DEV_ENV);
    expect(validated.PUBLIC_WEB_ORIGINS).toEqual(['http://localhost:4200']);
    expect(validated.AUTH_COOKIE_SECURE).toBe('false');
    expect(validated.JWT_SECRET).toBe(DEV_ENV.JWT_SECRET);
    expect(validated.AUTH_LOGIN_RATE_LIMIT).toBe(5);
    expect(validated.AUTH_LOGIN_RATE_TTL_SECONDS).toBe(60);
    expect(validated.PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE).toBe(60);
  });

  it('parses explicit throttle env integers', () => {
    const validated = validateEnv({
      ...DEV_ENV,
      AUTH_LOGIN_RATE_LIMIT: '3',
      AUTH_LOGIN_RATE_TTL_SECONDS: '120',
      PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE: '40',
    });
    expect(validated.AUTH_LOGIN_RATE_LIMIT).toBe(3);
    expect(validated.AUTH_LOGIN_RATE_TTL_SECONDS).toBe(120);
    expect(validated.PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE).toBe(40);
  });

  it('rejects non-positive throttle env values', () => {
    expect(() =>
      validateEnv({ ...DEV_ENV, AUTH_LOGIN_RATE_LIMIT: '0' }),
    ).toThrow(/AUTH_LOGIN_RATE_LIMIT/);
    expect(() =>
      validateEnv({ ...DEV_ENV, PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE: '1.5' }),
    ).toThrow(/PUBLIC_RATE_LIMIT_FALLBACK_PER_MINUTE/);
  });

  it('accepts production config with https origins and Secure cookies', () => {
    const validated = validateEnv(PROD_ENV);
    expect(validated.PUBLIC_WEB_ORIGINS).toEqual([
      'https://proyectocarta.com',
      'https://www.proyectocarta.com',
    ]);
    expect(validated.AUTH_COOKIE_SECURE).toBe('true');
    expect(validated.DATABASE_URL).toBe('postgresql://example');
  });

  it('rejects missing PUBLIC_WEB_ORIGIN', () => {
    expect(() =>
      validateEnv({ ...DEV_ENV, PUBLIC_WEB_ORIGIN: '' }),
    ).toThrow(/PUBLIC_WEB_ORIGIN/);
  });

  it('rejects identical JWT_SECRET and AUTH_PEPPER', () => {
    expect(() =>
      validateEnv({
        ...DEV_ENV,
        JWT_SECRET: 'same-secret-value-used-twice!!',
        AUTH_PEPPER: 'same-secret-value-used-twice!!',
      }),
    ).toThrow(/different/);
  });

  it('rejects production placeholder secrets', () => {
    expect(() =>
      validateEnv({
        ...PROD_ENV,
        JWT_SECRET: 'cambiar-por-un-secreto-largo-y-aleatorio',
      }),
    ).toThrow(/placeholder/);
  });

  it('rejects short production secrets', () => {
    expect(() =>
      validateEnv({
        ...PROD_ENV,
        JWT_SECRET: 'too-short-for-production-use',
      }),
    ).toThrow(/at least 32/);
  });

  it('rejects production without AUTH_COOKIE_SECURE=true', () => {
    expect(() =>
      validateEnv({ ...PROD_ENV, AUTH_COOKIE_SECURE: 'false' }),
    ).toThrow(/AUTH_COOKIE_SECURE/);
    expect(() =>
      validateEnv({ ...PROD_ENV, AUTH_COOKIE_SECURE: undefined }),
    ).toThrow(/AUTH_COOKIE_SECURE/);
  });

  it('rejects production without DIRECT_URL', () => {
    expect(() =>
      validateEnv({ ...PROD_ENV, DIRECT_URL: undefined }),
    ).toThrow(/DIRECT_URL/);
  });

  it('rejects DIRECT_URL on the transaction pooler port 6543', () => {
    expect(() =>
      validateEnv({
        ...PROD_ENV,
        DIRECT_URL:
          'postgresql://postgres.xxxx:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
      }),
    ).toThrow(/6543/);
  });
});

describe('usesSupabaseTransactionPooler', () => {
  it('detects port 6543 and ignores 5432', () => {
    expect(
      usesSupabaseTransactionPooler(
        'postgresql://postgres:x@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
      ),
    ).toBe(true);
    expect(
      usesSupabaseTransactionPooler(
        'postgresql://postgres:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
      ),
    ).toBe(false);
  });
});
