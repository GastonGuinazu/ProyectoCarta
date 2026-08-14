/**
 * Formas de datos que reflejan el bloque `tenant`/`branch`/`meta.features` de
 * `GET /api/v1/menu/public/:tenantSlug/:branchSlug` (docs/api-contracts.md §3.5).
 * Debe mantenerse sincronizado manualmente con ese contrato
 * (docs/frontend-architecture.md §4.3).
 */

export interface TenantBranding {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly primaryColor: string | null;
  readonly logoUrl: string | null;
}

export type BranchOperationalStatus = 'OPEN' | 'CLOSED_TEMPORARILY' | 'MAINTENANCE';

export interface BranchInfo {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly timezone: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly instagram: string | null;
  readonly bannerUrl: string | null;
  readonly operationalStatus: BranchOperationalStatus;
}

export interface TenantFeatureFlags {
  readonly webArEnabled: boolean;
  readonly i18nEnabled: boolean;
}

/**
 * Refleja los casos de éxito/error de la resolución de tenant. `notFound` y
 * `suspended` cubren los códigos de negocio de docs/api-contracts.md §3.7
 * (`TENANT_OR_BRANCH_NOT_FOUND`, `TENANT_SUSPENDED`); `error` cubre cualquier
 * otra falla (red caída, 500, respuesta inesperada) que no sea uno de esos dos
 * casos específicos.
 */
export type TenantResolutionStatus =
  | 'idle'
  | 'resolving'
  | 'resolved'
  | 'notFound'
  | 'suspended'
  | 'error';
