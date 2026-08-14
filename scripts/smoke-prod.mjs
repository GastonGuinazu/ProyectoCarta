#!/usr/bin/env node
/**
 * Smoke del primer deploy (docs/produccion-checklist.md §5).
 * Crea un restaurante de prueba, carga carta + foto, verifica QR/menú y suspende.
 * No pega al mismo origen de Vercel: usa API_PUBLIC_URL (api.*).
 */
try {
  await import('dotenv/config');
} catch {
  // Railway / CI inyectan el entorno.
}

const apiBase = trimTrailingSlash(requiredEnv('API_PUBLIC_URL'));
const webOrigin = trimTrailingSlash(requiredEnv('PUBLIC_WEB_ORIGIN').split(',')[0]);
const adminEmail = requiredEnv('SMOKE_ADMIN_EMAIL');
const adminPassword = requiredEnv('SMOKE_ADMIN_PASSWORD');
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const tenantSlug = `piloto-smoke-${stamp}`.slice(0, 80);
const branchSlug = 'casa-matriz';
const ownerEmail = `owner-${stamp}@smoke.proyectocarta.com`;
const ownerPassword = randomPassword();

const health = await apiJson('GET', '/health');
if (health.status !== 'ok') {
  fail(`Healthcheck unexpected: ${JSON.stringify(health)}`);
}
console.log('health ok');

const adminLogin = await apiJson('POST', '/admin/auth/login', {
  email: adminEmail,
  password: adminPassword,
});
const adminToken = bearer(adminLogin.accessToken);
console.log('platform admin login ok');

const created = await apiJson(
  'POST',
  '/admin/platform/tenants',
  {
    commercialName: `Piloto smoke ${stamp}`,
    tenantSlug,
    branchSlug,
    ownerFullName: 'Dueño smoke',
    ownerEmail,
    ownerPassword,
  },
  adminToken,
);
if (!created.tenantId || created.branchSlug !== branchSlug) {
  fail(`Tenant create unexpected: ${JSON.stringify(created)}`);
}
console.log(`tenant created ${created.tenantSlug}/${created.branchSlug}`);

const ownerLogin = await apiJson('POST', '/admin/auth/login', {
  email: ownerEmail,
  password: ownerPassword,
});
const ownerToken = bearer(ownerLogin.accessToken);
console.log('owner login ok');

const category = await apiJson(
  'POST',
  '/admin/catalog/categories',
  { name: { es: 'Entradas smoke' } },
  ownerToken,
);
const product = await apiJson(
  'POST',
  '/admin/catalog/products',
  {
    categoryId: category.id,
    name: { es: 'Provoleta smoke' },
    basePrice: 250000,
  },
  ownerToken,
);
console.log(`catalog ok product=${product.id}`);

const uploaded = await uploadPresentation(product.id, ownerToken);
if (!uploaded.publicUrl || !String(uploaded.publicUrl).includes('/object/public/')) {
  fail(`Upload did not return a public Storage URL: ${JSON.stringify(uploaded)}`);
}
console.log(`upload ok ${uploaded.publicUrl}`);

const menuPath = `/menu/public/${tenantSlug}/${branchSlug}`;
const publicMenu = await apiJson('GET', menuPath);
const productNames = JSON.stringify(publicMenu);
if (!productNames.includes('Provoleta smoke')) {
  fail('Public menu did not include the smoke product.');
}
if (!productNames.includes(uploaded.publicUrl) && !hasAnyPublicAsset(publicMenu)) {
  fail('Public menu did not expose the uploaded photo URL.');
}
console.log('public menu ok');

const qrUrl = `${webOrigin}/m/${tenantSlug}/${branchSlug}`;
const spa = await fetch(qrUrl, { redirect: 'follow' });
if (!spa.ok) {
  fail(`QR target ${qrUrl} returned ${spa.status}`);
}
console.log(`qr url ok ${qrUrl}`);

await apiJson(
  'PATCH',
  `/admin/platform/tenants/${created.tenantId}/status`,
  { status: 'SUSPENDED' },
  adminToken,
);
const suspended = await apiFetch('GET', menuPath);
if (suspended.status !== 404) {
  fail(`Suspended menu expected 404, got ${suspended.status}`);
}
const suspendedBody = await suspended.json().catch(() => ({}));
if (suspendedBody.code !== 'TENANT_SUSPENDED') {
  fail(`Suspended menu expected TENANT_SUSPENDED, got ${JSON.stringify(suspendedBody)}`);
}
console.log('suspend ok');

await apiJson(
  'PATCH',
  `/admin/platform/tenants/${created.tenantId}/status`,
  { status: 'ACTIVE' },
  adminToken,
);
console.log(`smoke passed. Inspect ${qrUrl} then suspend again from Gestión Global if it was only a drill.`);

function requiredEnv(name) {
  const value = process.env[name]?.trim() ?? '';
  if (!value) {
    fail(`${name} is required (see docs/hosting.md § Primer deploy).`);
  }
  return value;
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, '');
}

function bearer(token) {
  if (typeof token !== 'string' || token.length === 0) {
    fail('Login did not return accessToken.');
  }
  return token;
}

function randomPassword() {
  return `Smk-${stamp}-Aa1!`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function hasAnyPublicAsset(menu) {
  return JSON.stringify(menu).includes('/object/public/');
}

async function apiJson(method, path, body, accessToken) {
  const response = await apiFetch(method, path, body, accessToken);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(`${method} ${path} -> ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function apiFetch(method, path, body, accessToken) {
  const headers = { Accept: 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  /** @type {RequestInit} */
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return fetch(`${apiBase}${path}`, init);
}

async function uploadPresentation(productId, accessToken) {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const form = new FormData();
  form.append(
    'file',
    new Blob([png], { type: 'image/png' }),
    'smoke.png',
  );
  const response = await fetch(
    `${apiBase}/admin/catalog/products/${productId}/media?slot=presentation`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(`upload media -> ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}
