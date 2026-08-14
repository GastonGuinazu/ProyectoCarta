#!/usr/bin/env node
/**
 * Crea o actualiza el bucket de Storage con lectura pública.
 * Usa SUPABASE_SERVICE_ROLE_KEY: solo en el host de Nest (Railway), nunca en Vercel.
 */
try {
  await import('dotenv/config');
} catch {
  // Las variables ya pueden venir del entorno (Railway / CI).
}

const url = process.env.SUPABASE_URL?.trim() ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'menu-assets';
const fileSizeLimit = maxUploadBytes(process.env);

if (!url || !serviceRoleKey) {
  console.error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Set them on the API host, not on Vercel.',
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${serviceRoleKey}`,
  apikey: serviceRoleKey,
  'Content-Type': 'application/json',
};

const existing = await storageFetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
  method: 'GET',
  headers,
});

if (existing.ok) {
  const current = await existing.json();
  if (current.public === true && fileSizeLimitSatisfied(current, fileSizeLimit)) {
    console.log(`Bucket ${bucket} already public.`);
    process.exit(0);
  }

  const updated = await storageFetch(
    `${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        public: true,
        file_size_limit: fileSizeLimit,
      }),
    },
  );
  if (!updated.ok) {
    const body = await updated.text();
    console.error(`Failed to update bucket ${bucket}: ${updated.status} ${body}`);
    process.exit(1);
  }
  console.log(`Bucket ${bucket} updated for public read.`);
  process.exit(0);
}

if (existing.status !== 404) {
  const body = await existing.text();
  console.error(`Failed to read bucket ${bucket}: ${existing.status} ${body}`);
  process.exit(1);
}

const created = await storageFetch(`${url}/storage/v1/bucket`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    id: bucket,
    name: bucket,
    public: true,
    file_size_limit: fileSizeLimit,
  }),
});
if (!created.ok) {
  const body = await created.text();
  console.error(`Failed to create bucket ${bucket}: ${created.status} ${body}`);
  process.exit(1);
}

console.log(`Bucket ${bucket} created with public read.`);

function maxUploadBytes(env) {
  const image = parsePositiveInt(env.MEDIA_IMAGE_MAX_BYTES);
  const model = parsePositiveInt(env.MEDIA_MODEL_MAX_BYTES);
  const values = [image, model].filter((value) => value !== undefined);
  return values.length > 0 ? Math.max(...values) : undefined;
}

function parsePositiveInt(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function fileSizeLimitSatisfied(current, expected) {
  if (expected === undefined) {
    return true;
  }
  const currentLimit = Number(current.file_size_limit);
  return Number.isFinite(currentLimit) && currentLimit >= expected;
}

async function storageFetch(resource, init) {
  return fetch(resource, init);
}
