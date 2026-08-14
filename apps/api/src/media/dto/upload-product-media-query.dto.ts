import { IsIn } from 'class-validator';

export const PRODUCT_MEDIA_SLOTS = ['presentation', 'immersive'] as const;

export type ProductMediaSlot = (typeof PRODUCT_MEDIA_SLOTS)[number];

/** Query de POST/DELETE `/api/v1/admin/catalog/products/:id/media`. */
export class UploadProductMediaQueryDto {
  @IsIn(PRODUCT_MEDIA_SLOTS)
  slot!: ProductMediaSlot;
}
