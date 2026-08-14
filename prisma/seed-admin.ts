import { PrismaClient, RoleType, UserStatus } from '@prisma/client';
import {
  hashPassword,
  pepperFromSecret,
} from '../apps/api/src/auth/password-hash';
import 'dotenv/config';

/**
 * Siembra un PLATFORM_ADMIN de desarrollo (excepción de seed/testing,
 * .cursor/rules/01-global-architecture.mdc). Hash: Argon2id + AUTH_PEPPER.
 *
 * No publica credenciales. Email y contraseña salen de
 * PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD. En producción no corre:
 * el operador de prod se crea a mano (docs/hosting.md).
 */

const prisma = new PrismaClient();

const FORBIDDEN_PASSWORDS = new Set([
  'admin123',
  'password',
  'admin',
  'proyectocarta',
  '12345678',
]);

const MIN_PASSWORD_LENGTH = 8;

function readSeedAdminInput(env: NodeJS.ProcessEnv): {
  email: string;
  password: string;
  fullName: string;
} {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'No ejecutar seed-admin con NODE_ENV=production. Creá el PLATFORM_ADMIN de prod a mano (docs/hosting.md).',
    );
  }

  const email = env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = env.PLATFORM_ADMIN_PASSWORD ?? '';
  const fullName = env.PLATFORM_ADMIN_FULL_NAME?.trim() || 'Platform Admin';

  if (!email.includes('@')) {
    throw new Error(
      'PLATFORM_ADMIN_EMAIL is required (local only; never commit it)',
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `PLATFORM_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  if (FORBIDDEN_PASSWORDS.has(password.toLowerCase())) {
    throw new Error(
      'PLATFORM_ADMIN_PASSWORD rejects published defaults such as admin123',
    );
  }

  return { email, password, fullName };
}

async function seedAdmin(): Promise<void> {
  const { email, password, fullName } = readSeedAdminInput(process.env);
  const pepper = pepperFromSecret(process.env.AUTH_PEPPER ?? '');
  const passwordHash = await hashPassword(password, pepper);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      create: {
        email,
        fullName,
        passwordHash,
        status: UserStatus.ACTIVE,
        tenantId: null,
        preferredLanguage: 'es',
      },
      update: {
        fullName,
        passwordHash,
        status: UserStatus.ACTIVE,
        tenantId: null,
      },
    });

    await tx.roleAssignment.deleteMany({
      where: {
        userId: user.id,
        NOT: { role: RoleType.PLATFORM_ADMIN },
      },
    });

    const platformRole = await tx.roleAssignment.findFirst({
      where: {
        userId: user.id,
        role: RoleType.PLATFORM_ADMIN,
        tenantId: null,
        branchId: null,
      },
    });

    if (!platformRole) {
      await tx.roleAssignment.create({
        data: {
          userId: user.id,
          role: RoleType.PLATFORM_ADMIN,
          tenantId: null,
          branchId: null,
        },
      });
    }
  });

  console.log(`PLATFORM_ADMIN listo: ${email}`);
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
