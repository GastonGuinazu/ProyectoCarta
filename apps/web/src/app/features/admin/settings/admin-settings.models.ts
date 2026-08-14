export type AdminBrandingSlot = 'logo' | 'banner';

export type BranchOperationalStatus =
  | 'OPEN'
  | 'CLOSED_TEMPORARILY'
  | 'MAINTENANCE';

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

export interface AdminBranchSettingsWritePayload {
  readonly commercialName: string;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly instagram: string | null;
  readonly address: string | null;
  readonly accentColor: string | null;
  readonly operationalStatus: BranchOperationalStatus;
  readonly timezone: string;
}

export interface AdminBrandingUploadResponse {
  readonly id: string;
  readonly publicUrl: string;
  readonly fileName: string;
  readonly slot: AdminBrandingSlot;
}
