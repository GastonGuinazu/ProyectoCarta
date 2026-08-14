import {
  clientIp,
  isLoginPath,
  isPublicAnalyticsPath,
  isPublicMenuGetPath,
  tenantSlugFromRequest,
} from './throttle-route.util';

describe('throttle-route.util', () => {
  it('detects login even with the global api/v1 prefix', () => {
    expect(isLoginPath('POST', '/api/v1/admin/auth/login')).toBe(true);
    expect(isLoginPath('POST', '/admin/auth/login')).toBe(true);
    expect(isLoginPath('GET', '/api/v1/admin/auth/login')).toBe(false);
    expect(isLoginPath('POST', '/api/v1/admin/auth/refresh')).toBe(false);
  });

  it('detects public menu GET and not the events POST path', () => {
    expect(
      isPublicMenuGetPath('GET', '/api/v1/menu/public/don-luigi/centro'),
    ).toBe(true);
    expect(
      isPublicMenuGetPath('GET', '/api/v1/menu/public/don-luigi/centro/events'),
    ).toBe(false);
    expect(
      isPublicMenuGetPath('POST', '/api/v1/menu/public/don-luigi/centro'),
    ).toBe(false);
  });

  it('detects public analytics POST', () => {
    expect(
      isPublicAnalyticsPath(
        'POST',
        '/api/v1/menu/public/don-luigi/centro/events',
      ),
    ).toBe(true);
    expect(
      isPublicAnalyticsPath('GET', '/api/v1/menu/public/don-luigi/centro/events'),
    ).toBe(false);
  });

  it('reads tenant slug from params or path', () => {
    expect(
      tenantSlugFromRequest({ params: { tenantSlug: 'don-luigi' } }),
    ).toBe('don-luigi');
    expect(
      tenantSlugFromRequest({
        path: '/api/v1/menu/public/don-luigi/centro',
      }),
    ).toBe('don-luigi');
  });

  it('prefers Express req.ips behind a trusted proxy', () => {
    expect(clientIp({ ip: '10.0.0.1', ips: ['203.0.113.9'] })).toBe(
      '203.0.113.9',
    );
    expect(clientIp({ ip: '127.0.0.1' })).toBe('127.0.0.1');
    expect(clientIp({})).toBe('unknown');
  });
});
