import { ArrayNotEmpty, ArrayUnique, IsArray } from 'class-validator';
import { IsUuidLike } from '../../../core';

/**
 * Body de `PATCH /api/v1/admin/catalog/categories/reorder`.
 * `categoryIds` es el orden visual completo del tenant (índice = campo `order`).
 */
export class ReorderCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUuidLike({ each: true })
  categoryIds!: string[];
}
