import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dest = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'environments',
  'api-base.generated.ts',
);

const raw = process.env.API_PUBLIC_URL?.trim() ?? '';

if (!raw && process.env.VERCEL === '1') {
  console.error(
    'API_PUBLIC_URL is required on Vercel (e.g. https://api.proyectocarta.com/api/v1). ' +
      'Do not proxy /api through Vercel — uploads exceed the ~4.5 MB body limit (docs/hosting.md).',
  );
  process.exit(1);
}

const url = (raw || '/api/v1').replace(/\/$/, '');

writeFileSync(
  dest,
  [
    '/**',
    ' * Generado por scripts/write-web-api-base.mjs — no editar a mano.',
    ' */',
    `export const productionApiBaseUrl = ${JSON.stringify(url)};`,
    '',
  ].join('\n'),
);
