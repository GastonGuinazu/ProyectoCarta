import { Inject, Injectable } from '@nestjs/common';
import {
  TENANT_PRISMA_CLIENT,
  type TenantScopedPrismaClient,
} from '../../core';
import type { BranchDetails } from './branch-details.type';

/**
 * Única capa autorizada a hablar con Prisma para el modelo `Branch`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta el cliente extendido
 * (`TENANT_PRISMA_CLIENT`), nunca `PrismaService` crudo.
 */
@Injectable()
export class BranchRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * PRUEBA DE AISLAMIENTO END-TO-END (docs/backend-architecture.md §4.2): a
   * diferencia del resto de los métodos de Repository, este `where` NO incluye
   * `tenantId` a propósito. El objetivo es forzar a la Capa 2 (Prisma Client
   * Extension, ver `core/prisma/prisma-tenant.extension.ts`) a inyectarlo
   * automáticamente desde el `TenantContext` activo en `AsyncLocalStorage`.
   *
   * No repliques este patrón en otros métodos: la Capa 1 sigue exigiendo
   * `tenantId` explícito como parámetro obligatorio en cada Repository.
   */
  async getBranchDetails(branchId: string): Promise<BranchDetails | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId },
    });
    if (!branch) {
      return null;
    }

    return {
      id: branch.id,
      slug: branch.slug,
      name: branch.name,
      timezone: branch.timezone,
      address: branch.address,
      phone: branch.phone,
      whatsapp: branch.whatsapp,
      operationalStatus: branch.operationalStatus,
    };
  }
}
