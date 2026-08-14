import { IsLocalizedText } from '../../product/dto/is-localized-text.validator';

/** Body de `PUT /api/v1/admin/catalog/categories/:id`. */
export class UpdateCategoryDto {
  @IsLocalizedText()
  name!: Record<string, string>;
}
