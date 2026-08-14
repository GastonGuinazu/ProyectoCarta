import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TenantStatus } from '@prisma/client';
import { hashPassword, pepperFromSecret } from '../../auth/password-hash';
import { AdminPlatformRepository } from './admin-platform.repository';
import type { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';
import type {
  PlatformTenantCreated,
  PlatformTenantListItem,
} from './admin-platform.types';

const DEFAULT_BRANCH_NAME = 'Casa Matriz';

@Injectable()
export class AdminPlatformService {
  constructor(
    private readonly adminPlatformRepository: AdminPlatformRepository,
    private readonly config: ConfigService,
  ) {}

  listTenants(): Promise<PlatformTenantListItem[]> {
    return this.adminPlatformRepository.listTenants();
  }

  async createTenant(
    dto: CreatePlatformTenantDto,
  ): Promise<PlatformTenantCreated> {
    const pepper = pepperFromSecret(this.config.getOrThrow<string>('AUTH_PEPPER'));
    const passwordHash = await hashPassword(dto.ownerPassword, pepper);

    return this.adminPlatformRepository.createTenantWithOwnerAndBranch({
      commercialName: dto.commercialName,
      tenantSlug: dto.tenantSlug,
      branchName: dto.branchName?.trim() || DEFAULT_BRANCH_NAME,
      branchSlug: dto.branchSlug,
      ownerFullName: dto.ownerFullName,
      ownerEmail: dto.ownerEmail,
      passwordHash,
    });
  }

  updateTenantStatus(
    tenantId: string,
    status: TenantStatus,
  ): Promise<PlatformTenantListItem> {
    return this.adminPlatformRepository.updateTenantStatus(tenantId, status);
  }

  async resetOwnerPassword(
    tenantId: string,
    newPassword: string,
  ): Promise<PlatformTenantListItem> {
    const pepper = pepperFromSecret(this.config.getOrThrow<string>('AUTH_PEPPER'));
    const passwordHash = await hashPassword(newPassword, pepper);
    return this.adminPlatformRepository.resetOwnerPassword(tenantId, passwordHash);
  }
}
