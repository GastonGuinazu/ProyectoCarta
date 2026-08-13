import type { BranchOperationalStatus } from '@prisma/client';

/**
 * Forma mínima de datos de Sucursal expuesta fuera del Repository. Se mapea desde
 * el modelo crudo de Prisma para no filtrar el tipo de la base de datos hacia
 * arriba (.cursor/rules/03-backend-nestjs.mdc — "Repositories... devuelven
 * entidades/DTOs de dominio, nunca el tipo crudo de Prisma").
 */
export interface BranchDetails {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly timezone: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly operationalStatus: BranchOperationalStatus;
}
