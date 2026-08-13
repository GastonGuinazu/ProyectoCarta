import { NotFoundException } from '@nestjs/common';

/**
 * Tenant o Sucursal no encontrados por slug. Se usa el mismo código genérico para
 * ambos casos deliberadamente (docs/api-contracts.md §3.7): no debe filtrarse si
 * el problema fue el tenant o la sucursal.
 */
export class TenantOrBranchNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'TENANT_OR_BRANCH_NOT_FOUND',
      message:
        'El restaurante o la sucursal solicitada no existe o no está disponible.',
    });
  }
}

/**
 * El Tenant existe pero está suspendido/cancelado (docs/api-contracts.md §3.7).
 * Se modela como "menú no disponible" (404), nunca como error técnico.
 */
export class TenantSuspendedException extends NotFoundException {
  constructor() {
    super({
      code: 'TENANT_SUSPENDED',
      message: 'Este menú no está disponible en este momento.',
    });
  }
}
