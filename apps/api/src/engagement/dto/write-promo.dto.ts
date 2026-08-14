import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PromoDiscountType } from '@prisma/client';
import { IsUuidLike } from '../../core';
import { IsLocalizedText } from '../../catalog/product/dto/is-localized-text.validator';

export class WritePromoDto {
  @IsLocalizedText()
  name!: Record<string, string>;

  @IsOptional()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsEnum(PromoDiscountType)
  discountType!: PromoDiscountType;

  @ValidateIf((dto: WritePromoDto) => dto.discountType === PromoDiscountType.PERCENTAGE)
  @IsInt()
  @Min(1)
  @Max(10_000)
  discountPercentageBp?: number;

  @ValidateIf((dto: WritePromoDto) => dto.discountType === PromoDiscountType.FIXED_AMOUNT)
  @IsInt()
  @Min(1)
  discountAmountCents?: number;

  @ValidateIf((dto: WritePromoDto) => dto.discountType === PromoDiscountType.FIXED_PRICE)
  @IsInt()
  @Min(0)
  fixedPriceCents?: number;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  priority?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUuidLike({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUuidLike({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUuidLike({ each: true })
  comboIds?: string[];
}
