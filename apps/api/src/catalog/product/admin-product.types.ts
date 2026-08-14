import type { AvailabilityStatus, VariantSelectionType } from '@prisma/client';
import type { LocalizedText } from '../../core';

export interface AdminVariantOptionWrite {
  readonly name: LocalizedText;
  readonly priceDeltaCents: number;
  readonly order: number;
}

export interface AdminVariantGroupWrite {
  readonly name: LocalizedText;
  readonly selectionType: VariantSelectionType;
  readonly required: boolean;
  readonly order: number;
  readonly options: readonly AdminVariantOptionWrite[];
}

export interface AdminProductWriteInput {
  readonly categoryId: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly basePriceCents: number;
  readonly currency?: string;
  readonly sku: string | null;
  readonly order: number;
  readonly availability: AvailabilityStatus;
  readonly availableInAllBranches: boolean;
  readonly branchIds: readonly string[];
  readonly allergenIds: readonly string[];
  readonly dietaryTagIds: readonly string[];
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
  readonly primaryMediaAssetId: string | null;
  readonly galleryMediaAssetIds: readonly string[];
  readonly variantGroups: readonly AdminVariantGroupWrite[];
}

export interface AdminProductPatchInput {
  readonly categoryId?: string;
  readonly name?: LocalizedText;
  readonly description?: LocalizedText | null;
  readonly basePriceCents?: number;
  readonly currency?: string;
  readonly sku?: string | null;
  readonly order?: number;
  readonly availability?: AvailabilityStatus;
  readonly availableInAllBranches?: boolean;
  readonly branchIds?: readonly string[];
  readonly allergenIds?: readonly string[];
  readonly dietaryTagIds?: readonly string[];
  readonly servedStartMinuteOfDay?: number | null;
  readonly servedEndMinuteOfDay?: number | null;
  readonly primaryMediaAssetId?: string | null;
  readonly galleryMediaAssetIds?: readonly string[];
  readonly variantGroups?: readonly AdminVariantGroupWrite[];
}

export interface AdminProductListRow {
  readonly id: string;
  readonly categoryId: string;
  readonly categoryName: LocalizedText;
  readonly name: LocalizedText;
  readonly basePriceCents: number;
  readonly currency: string;
  readonly availability: AvailabilityStatus;
  readonly primaryUrl: string | null;
}

export interface AdminProductRecord {
  readonly id: string;
  readonly slug: string;
  readonly categoryId: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly basePriceCents: number;
  readonly currency: string;
  readonly sku: string | null;
  readonly order: number;
  readonly availability: AvailabilityStatus;
  readonly availableInAllBranches: boolean;
  readonly allergenIds: readonly string[];
  readonly dietaryTagIds: readonly string[];
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
  readonly branchIds: readonly string[];
  readonly primaryMediaAssetId: string | null;
  readonly primaryMediaUrl: string | null;
  readonly primaryMediaFileType: string | null;
  readonly arModelMediaAssetId: string | null;
  readonly arModelUrl: string | null;
  readonly galleryMediaAssetIds: readonly string[];
  readonly variantGroups: readonly {
    readonly id: string;
    readonly name: LocalizedText;
    readonly selectionType: VariantSelectionType;
    readonly required: boolean;
    readonly options: readonly {
      readonly id: string;
      readonly name: LocalizedText;
      readonly priceDeltaCents: number;
      readonly available: boolean;
    }[];
  }[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
