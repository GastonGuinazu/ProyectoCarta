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
import { IsUuidLike } from '../../../core';
import { IsLocalizedText } from '../../product/dto/is-localized-text.validator';

export class ComboItemDto {
  @IsUuidLike()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

/** Body de `POST /api/v1/admin/catalog/combos`. */
export class CreateComboDto {
  @IsLocalizedText()
  name!: Record<string, string>;

  @IsOptional()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availability?: AvailabilityStatus;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items!: ComboItemDto[];
}
