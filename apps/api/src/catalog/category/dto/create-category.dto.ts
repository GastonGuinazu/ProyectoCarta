import { IsLocalizedText } from '../../product/dto/is-localized-text.validator';

/** Body de `POST /api/v1/admin/catalog/categories`. */
export class CreateCategoryDto {
  @IsLocalizedText()
  name!: Record<string, string>;
}
