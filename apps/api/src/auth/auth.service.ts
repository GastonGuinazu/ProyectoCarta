import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleType, TenantStatus, UserStatus } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { UserService } from '../tenant/user/user.service';
import type { AuthUserRecord } from '../tenant/user/user.repository';
import { AuthRepository } from './auth.repository';
import type { JwtPayload, JwtRoleClaim } from './auth.types';
import {
  AccountDisabledException,
  AuthTenantSuspendedException,
  CurrentPasswordInvalidException,
  InvalidCredentialsException,
  InvalidRefreshTokenException,
  NewPasswordMustDifferException,
} from './exceptions/auth.exceptions';
import {
  hashPassword,
  pepperFromSecret,
  verifyPassword,
} from './password-hash';

export interface LoginResponseBody {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly user: {
    readonly id: string;
    readonly fullName: string;
    readonly email: string;
    readonly preferredLanguage: string;
    readonly status: UserStatus;
  };
  readonly tenant: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly plan: string;
  } | null;
  readonly roleAssignments: readonly JwtRoleClaim[];
  readonly accessibleBranches: readonly {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
  }[];
}

export interface LoginResult {
  readonly body: LoginResponseBody;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

/**
 * Identidad y sesión del Panel Admin. Hash de contraseña: Argon2id + pepper
 * (docs/architecture.md §2.3). No se usa bcrypt.
 */
@Injectable()
export class AuthService {
  private readonly dummyHashPromise: Promise<string>;

  constructor(
    private readonly userService: UserService,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.dummyHashPromise = hashPassword(
      'invalid-credentials-placeholder',
      this.pepper(),
    );
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.userService.findByEmailForLogin(email);
    const hashToVerify = user?.passwordHash ?? (await this.dummyHashPromise);
    const passwordMatches = await verifyPassword(
      hashToVerify,
      password,
      this.pepper(),
    );

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsException();
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AccountDisabledException();
    }
    if (this.isTenantBlocked(user)) {
      throw new AuthTenantSuspendedException();
    }
    if (user.roleAssignments.length === 0) {
      throw new AccountDisabledException();
    }

    const access = await this.issueAccess(user);
    const refresh = this.createOpaqueRefreshToken();
    await this.authRepository.persistRefreshToken({
      userId: user.id,
      tokenHash: refresh.tokenHash,
      familyId: refresh.familyId,
      expiresAt: refresh.expiresAt,
    });
    await this.userService.touchLastLogin(user.id);

    return {
      body: this.toLoginBody(
        user,
        access.accessToken,
        access.expiresIn,
        access.roles,
      ),
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  /**
   * Cambia la clave del usuario del JWT (`sub` + `tenantId` de claims).
   * Revoca todos los refresh y emite uno nuevo para esta sesión.
   */
  async changePassword(
    userId: string,
    tenantId: string | null,
    currentPassword: string,
    newPassword: string,
  ): Promise<Pick<LoginResult, 'refreshToken' | 'refreshExpiresAt'>> {
    const user = await this.userService.findByIdForSession(userId);
    const hashToVerify = user?.passwordHash ?? (await this.dummyHashPromise);
    const passwordMatches = await verifyPassword(
      hashToVerify,
      currentPassword,
      this.pepper(),
    );

    if (!user || user.tenantId !== tenantId || !passwordMatches) {
      throw new CurrentPasswordInvalidException();
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AccountDisabledException();
    }
    if (currentPassword === newPassword) {
      throw new NewPasswordMustDifferException();
    }

    const passwordHash = await hashPassword(newPassword, this.pepper());
    const updated = await this.userService.updatePasswordHash({
      userId: user.id,
      tenantId: user.tenantId,
      passwordHash,
    });
    if (!updated) {
      throw new AccountDisabledException();
    }

    await this.authRepository.revokeAllForUser(user.id);
    const refresh = this.createOpaqueRefreshToken();
    await this.authRepository.persistRefreshToken({
      userId: user.id,
      tokenHash: refresh.tokenHash,
      familyId: refresh.familyId,
      expiresAt: refresh.expiresAt,
    });

    return {
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  /**
   * Rota el refresh de la cookie y emite un access JWT nuevo
   * (docs/api-contracts.md §4.4). Reuse de un token ya rotado revoca la familia.
   */
  async refresh(rawCookie: string | undefined): Promise<LoginResult> {
    if (!rawCookie) {
      throw new InvalidRefreshTokenException();
    }

    const existing = await this.authRepository.findRefreshTokenByHash(
      this.hashRefreshToken(rawCookie),
    );
    if (!existing) {
      throw new InvalidRefreshTokenException();
    }

    if (existing.revokedAt) {
      await this.authRepository.revokeFamily(existing.familyId);
      throw new InvalidRefreshTokenException();
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new InvalidRefreshTokenException();
    }

    const user = await this.userService.findByIdForSession(existing.userId);
    if (!user) {
      await this.authRepository.revokeFamily(existing.familyId);
      throw new InvalidRefreshTokenException();
    }
    if (user.status !== UserStatus.ACTIVE) {
      await this.authRepository.revokeFamily(existing.familyId);
      throw new AccountDisabledException();
    }
    if (this.isTenantBlocked(user)) {
      throw new AuthTenantSuspendedException();
    }
    if (user.roleAssignments.length === 0) {
      await this.authRepository.revokeFamily(existing.familyId);
      throw new AccountDisabledException();
    }

    const refresh = this.createOpaqueRefreshToken(existing.familyId);
    await this.authRepository.rotateRefreshToken({
      currentId: existing.id,
      userId: user.id,
      tokenHash: refresh.tokenHash,
      familyId: refresh.familyId,
      expiresAt: refresh.expiresAt,
    });

    const access = await this.issueAccess(user);
    return {
      body: this.toLoginBody(
        user,
        access.accessToken,
        access.expiresIn,
        access.roles,
      ),
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  cookieName(): string {
    return this.config.get<string>('AUTH_REFRESH_COOKIE_NAME') ?? 'pc_refresh';
  }

  cookieSecure(): boolean {
    return this.config.get<string>('AUTH_COOKIE_SECURE') === 'true';
  }

  /**
   * SameSite=Strict: web y API comparten eTLD+1 (proyectocarta.com /
   * api.proyectocarta.com), así que el refresh viaja en `fetch` con
   * credentials. No es configurable: SameSite=None no hace falta y
   * Domain=.proyectocarta.com ampliaría la cookie (docs/hosting.md).
   */
  cookieSameSite(): 'strict' {
    return 'strict';
  }

  private pepper(): Buffer {
    return pepperFromSecret(this.config.getOrThrow<string>('AUTH_PEPPER'));
  }

  private accessExpiresSeconds(): number {
    const raw = this.config.get<string>('JWT_ACCESS_EXPIRES_SECONDS');
    const parsed = raw ? Number.parseInt(raw, 10) : 900;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
  }

  private isTenantBlocked(user: AuthUserRecord): boolean {
    if (!user.tenant) {
      return false;
    }
    return (
      user.tenant.status === TenantStatus.SUSPENDED ||
      user.tenant.status === TenantStatus.CANCELLED
    );
  }

  private toJwtRoles(user: AuthUserRecord): JwtRoleClaim[] {
    return user.roleAssignments.map((assignment) => {
      if (assignment.role === RoleType.PLATFORM_ADMIN) {
        return {
          role: assignment.role,
          scope: 'PLATFORM',
          branchId: null,
        };
      }
      if (assignment.branchId === null) {
        return {
          role: assignment.role,
          scope: 'TENANT',
          branchId: null,
        };
      }
      return {
        role: assignment.role,
        scope: 'BRANCH',
        branchId: assignment.branchId,
      };
    });
  }

  private toLoginBody(
    user: AuthUserRecord,
    accessToken: string,
    expiresIn: number,
    roles: readonly JwtRoleClaim[],
  ): LoginResponseBody {
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        preferredLanguage: user.preferredLanguage,
        status: user.status,
      },
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            slug: user.tenant.slug,
            name: user.tenant.name,
            plan: user.tenant.planName,
          }
        : null,
      roleAssignments: roles,
      accessibleBranches: this.accessibleBranches(user, roles),
    };
  }

  private accessibleBranches(
    user: AuthUserRecord,
    roles: readonly JwtRoleClaim[],
  ): AuthUserRecord['branches'] {
    if (roles.some((role) => role.scope === 'PLATFORM')) {
      return [];
    }
    if (roles.some((role) => role.scope === 'TENANT')) {
      return user.branches;
    }
    const allowed = new Set(
      roles
        .map((role) => role.branchId)
        .filter((branchId): branchId is string => branchId !== null),
    );
    return user.branches.filter((branch) => allowed.has(branch.id));
  }

  private async issueAccess(user: AuthUserRecord): Promise<{
    accessToken: string;
    expiresIn: number;
    roles: JwtRoleClaim[];
  }> {
    const roles = this.toJwtRoles(user);
    const expiresIn = this.accessExpiresSeconds();
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      roles,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn,
    });
    return { accessToken, expiresIn, roles };
  }

  private hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private createOpaqueRefreshToken(familyId: string = randomUUID()): {
    raw: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  } {
    const raw = randomBytes(32).toString('base64url');
    const daysRaw = this.config.get<string>('AUTH_REFRESH_EXPIRES_DAYS');
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 14;
    const safeDays = Number.isFinite(days) && days > 0 ? days : 14;
    const expiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
    return {
      raw,
      tokenHash: this.hashRefreshToken(raw),
      familyId,
      expiresAt,
    };
  }
}
