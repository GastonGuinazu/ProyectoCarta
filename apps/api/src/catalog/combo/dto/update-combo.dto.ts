import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { AvailabilityStatus } from '@prisma/client';
import { IsLocalizedText } from '../../product/dto/is-localized-text.validator';
import { ComboItemDto } from './create-combo.dto';

/** Body de `PUT /api/v1/admin/catalog/combos/:id`. */
export class UpdateComboDto {
  @IsOptional()
  @IsLocalizedText()
  name?: Record<string, string>;

  @IsOptional()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availability?: AvailabilityStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items?: ComboItemDto[];
}
