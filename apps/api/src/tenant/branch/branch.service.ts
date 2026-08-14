import { Injectable } from '@nestjs/common';
import type { BranchOperationalStatus } from '@prisma/client';
import type { BranchDetails } from './branch-details.type';
import { BranchRepository } from './branch.repository';

/**
 * Lógica de negocio del dominio Tenant relacionada a Sucursales. Por ahora es un
 * simple passthrough al Repository (no hay reglas de negocio todavía); a medida
 * que se agreguen (ej. validación de horarios, `scheduleJson`), viven aquí, nunca
 * en el Controller ni en el Repository (.cursor/rules/03-backend-nestjs.mdc).
 */
@Injectable()
export class BranchService {
  constructor(private readonly branchRepository: BranchRepository) {}

  async getBranchDetails(branchId: string): Promise<BranchDetails | null> {
    return this.branchRepository.getBranchDetails(branchId);
  }

  async findExistingIds(
    tenantId: string,
    branchIds: readonly string[],
  ): Promise<readonly string[]> {
    return this.branchRepository.findExistingIds(tenantId, branchIds);
  }

  findPrimaryId(tenantId: string): Promise<string | null> {
    return this.branchRepository.findPrimaryId(tenantId);
  }

  countByTenant(tenantId: string): Promise<number> {
    return this.branchRepository.countByTenant(tenantId);
  }

  listForAdmin(tenantId: string) {
    return this.branchRepository.listForAdmin(tenantId);
  }

  createForTenant(
    tenantId: string,
    data: {
      readonly name: string;
      readonly slug: string;
      readonly timezone: string;
      readonly copyFromBranchId?: string;
    },
  ) {
    return this.branchRepository.createForTenant(tenantId, data);
  }

  updateForAdmin(
    tenantId: string,
    branchId: string,
    patch: {
      readonly name?: string;
      readonly slug?: string;
    },
  ) {
    return this.branchRepository.updateForAdmin(tenantId, branchId, patch);
  }

  updateContact(
    tenantId: string,
    branchId: string,
    data: {
      readonly phone?: string | null;
      readonly whatsapp?: string | null;
      readonly instagram?: string | null;
      readonly address?: string | null;
      readonly operationalStatus?: BranchOperationalStatus;
      readonly timezone?: string;
    },
  ): Promise<void> {
    return this.branchRepository.updateContact(tenantId, branchId, data);
  }

  attachBanner(
    tenantId: string,
    branchId: string,
    mediaAssetId: string,
  ): Promise<{ readonly id: string; readonly originalUrl: string } | null> {
    return this.branchRepository.attachBanner(tenantId, branchId, mediaAssetId);
  }

  detachBanner(
    tenantId: string,
    branchId: string,
  ): Promise<{ readonly id: string; readonly originalUrl: string } | null> {
    return this.branchRepository.detachBanner(tenantId, branchId);
  }
}
