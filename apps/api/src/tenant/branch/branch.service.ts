import { Injectable } from '@nestjs/common';
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
}
