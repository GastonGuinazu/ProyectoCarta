#!/usr/bin/env node
/**
 * Arranque del proceso largo de Nest (Railway / Render / Fly).
 * Corre `prisma migrate deploy` contra DIRECT_URL y después levanta la API.
 * No usar como Vercel Function (docs/hosting.md).
 */
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const prismaCli = join(root, 'node_modules', 'prisma', 'build', 'index.js');
const nestMain = join(root, 'apps', 'api', 'dist', 'main.js');

assertDirectUrl(process.env.DIRECT_URL);

const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const nest = spawn(process.execPath, [nestMain], {
  cwd: join(root, 'apps', 'api'),
  env: process.env,
  stdio: 'inherit',
});

const forward = (signal) => {
  if (!nest.killed) {
    nest.kill(signal);
  }
};

process.on('SIGTERM', () => forward('SIGTERM'));
process.on('SIGINT', () => forward('SIGINT'));

nest.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

function assertDirectUrl(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    console.error(
      'DIRECT_URL is required for prisma migrate deploy (port 5432, not the pooler 6543).',
    );
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    console.error('DIRECT_URL must be a valid URL.');
    process.exit(1);
  }

  if (parsed.port === '6543') {
    console.error(
      'DIRECT_URL must not use the Supabase pooler port 6543. Use the direct connection on 5432 (docs/hosting.md).',
    );
    process.exit(1);
  }
}
