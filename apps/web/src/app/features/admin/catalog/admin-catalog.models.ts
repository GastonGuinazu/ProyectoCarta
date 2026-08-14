import type { LocalizedText } from '../../../core/models/menu.models';

export type AdminProductAvailability =
  | 'AVAILABLE'
  | 'OUT_OF_STOCK'
  | 'DISCONTINUED';

export interface AdminProductListItem {
  readonly id: string;
  readonly name: LocalizedText;
  readonly categoryId: string;
  readonly categoryName: LocalizedText;
  readonly basePrice: number;
  readonly currency: string;
  readonly availability: AdminProductAvailability;
  readonly primaryUrl: string | null;
}

export interface AdminProductListResponse {
  readonly items: readonly AdminProductListItem[];
}

export interface AdminCategorySummary {
  readonly id: string;
  readonly name: LocalizedText;
  readonly order: number;
  readonly productCount: number;
  readonly childCount: number;
}

export interface AdminCategoryListResponse {
  readonly items: readonly AdminCategorySummary[];
}

export interface AdminCategoryWritePayload {
  readonly name: LocalizedText;
}

export interface AdminCategoryReorderPayload {
  readonly categoryIds: readonly string[];
}

export type AdminMediaFileType = 'IMAGE' | 'VIDEO' | 'MODEL_3D';

export interface AdminProductDetail {
  readonly id: string;
  readonly slug: string;
  readonly categoryId: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly basePrice: number;
  readonly currency: string;
  readonly availability: AdminProductAvailability;
  readonly allergenIds: readonly string[];
  readonly dietaryTagIds: readonly string[];
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
  readonly media?: {
    readonly primaryMediaAssetId: string | null;
    readonly primaryUrl: string | null;
    readonly primaryFileType: AdminMediaFileType | null;
    readonly galleryMediaAssetIds: readonly string[];
    readonly arModel?: {
      readonly mediaAssetId: string | null;
      readonly url: string | null;
    };
  };
}

export type AdminProductMediaSlot = 'presentation' | 'immersive';

export interface AdminProductMediaUploadResponse {
  readonly id: string;
  readonly publicUrl: string;
  readonly fileType: AdminMediaFileType;
  readonly fileName: string;
  readonly role: 'PRIMARY' | 'GALLERY' | 'AR_MODEL';
}

export interface AdminProductWritePayload {
  readonly categoryId: string;
  readonly name: LocalizedText;
  readonly description?: LocalizedText;
  readonly basePrice: number;
  readonly currency?: string;
  readonly availability: AdminProductAvailability;
  readonly allergenIds: readonly string[];
  readonly dietaryTagIds: readonly string[];
  readonly servedStartMinuteOfDay: number | null;
  readonly servedEndMinuteOfDay: number | null;
}

export interface AdminComboItem {
  readonly productId: string;
  readonly quantity: number;
  readonly productName: LocalizedText;
}

export interface AdminComboListItem {
  readonly id: string;
  readonly name: LocalizedText;
  readonly price: number;
  readonly currency: string;
  readonly availability: AdminProductAvailability;
  readonly items: readonly AdminComboItem[];
}

export interface AdminComboListResponse {
  readonly items: readonly AdminComboListItem[];
}

export interface AdminComboDetail {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly price: number;
  readonly currency: string;
  readonly availability: AdminProductAvailability;
  readonly imageUrl: string | null;
  readonly items: readonly AdminComboItem[];
}

export interface AdminComboMediaUploadResponse {
  readonly id: string;
  readonly publicUrl: string;
  readonly fileName: string;
}

export interface AdminComboWritePayload {
  readonly name: LocalizedText;
  readonly description?: LocalizedText;
  readonly price: number;
  readonly currency?: string;
  readonly availability: AdminProductAvailability;
  readonly items: readonly {
    readonly productId: string;
    readonly quantity: number;
  }[];
}

export interface AdminCatalogTag {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly iconUrl: string | null;
}

export interface AdminCatalogTagsResponse {
  readonly allergens: readonly AdminCatalogTag[];
  readonly dietaryTags: readonly AdminCatalogTag[];
}

