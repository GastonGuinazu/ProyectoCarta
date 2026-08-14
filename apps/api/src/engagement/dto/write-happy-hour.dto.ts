import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { DayOfWeek, PromoDiscountType } from '@prisma/client';
import { IsUuidLike } from '../../core';
import { IsLocalizedText } from '../../catalog/product/dto/is-localized-text.validator';

export class WriteHappyHourDto {
  @IsLocalizedText()
  name!: Record<string, string>;

  @IsEnum(PromoDiscountType)
  discountType!: PromoDiscountType;

  @ValidateIf(
    (dto: WriteHappyHourDto) => dto.discountType === PromoDiscountType.PERCENTAGE,
  )
  @IsInt()
  @Min(1)
  @Max(10_000)
  discountPercentageBp?: number;

  @ValidateIf(
    (dto: WriteHappyHourDto) => dto.discountType === PromoDiscountType.FIXED_AMOUNT,
  )
  @IsInt()
  @Min(1)
  discountAmountCents?: number;

  @ValidateIf(
    (dto: WriteHappyHourDto) => dto.discountType === PromoDiscountType.FIXED_PRICE,
  )
  @IsInt()
  @Min(0)
  fixedPriceCents?: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(DayOfWeek, { each: true })
  daysOfWeek!: DayOfWeek[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinuteOfDay!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinuteOfDay!: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

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
