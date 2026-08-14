import * as argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
} as const;

/**
 * Parámetros únicos de hash de contraseña del Panel Admin
 * (docs/architecture.md §2.3). Usado por `AuthService` y por `prisma/seed-admin.ts`.
 */
export function pepperFromSecret(secret: string): Buffer {
  if (!secret) {
    throw new Error('AUTH_PEPPER is required');
  }
  return Buffer.from(secret, 'utf8');
}

export function hashPassword(plain: string, pepper: Buffer): Promise<string> {
  return argon2.hash(plain, {
    ...ARGON2_OPTIONS,
    secret: pepper,
  });
}

export async function verifyPassword(
  passwordHash: string,
  plain: string,
  pepper: Buffer,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, plain, { secret: pepper });
  } catch {
    return false;
  }
}
