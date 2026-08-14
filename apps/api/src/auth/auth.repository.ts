import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core';

export interface PersistRefreshTokenInput {
  readonly userId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
}

export interface RotateRefreshTokenInput extends PersistRefreshTokenInput {
  readonly currentId: string;
}

export interface RefreshTokenRecord {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

/**
 * Persistencia de refresh opacos. `RefreshToken` no es tenant-scoped
 * (prisma/schema.prisma): se usa `PrismaService` crudo, igual que el login.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async persistRefreshToken(input: PersistRefreshTokenInput): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        familyId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
    return row;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async rotateRefreshToken(input: RotateRefreshTokenInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          familyId: input.familyId,
          expiresAt: input.expiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: input.currentId },
        data: {
          revokedAt: new Date(),
          replacedById: created.id,
        },
      });
    });
  }
}
