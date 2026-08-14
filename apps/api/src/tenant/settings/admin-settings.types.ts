import type { BranchOperationalStatus } from '@prisma/client';

export interface AdminBranchSettings {
  readonly branchId: string;
  readonly tenantSlug: string;
  readonly branchSlug: string;
  readonly commercialName: string;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly instagram: string | null;
  readonly address: string | null;
  readonly accentColor: string | null;
  readonly logoUrl: string | null;
  readonly bannerUrl: string | null;
  readonly operationalStatus: BranchOperationalStatus;
  readonly timezone: string;
}

export interface AdminBranchSettingsPatch {
  readonly commercialName?: string;
  readonly phone?: string | null;
  readonly whatsapp?: string | null;
  readonly instagram?: string | null;
  readonly address?: string | null;
  readonly accentColor?: string | null;
  readonly operationalStatus?: BranchOperationalStatus;
  readonly timezone?: string;
}

export interface PublicTenantBranding {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly branding: {
    readonly primaryColor: string | null;
    readonly logoUrl: string | null;
  };
}

export interface DetachedMediaRef {
  readonly id: string;
  readonly originalUrl: string;
}
