import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AvailabilityStatus } from '@prisma/client';
import {
  BranchAvailabilityDto,
  ProductMediaDto,
  ServingWindowDto,
  VariantGroupDto,
} from './create-product.dto';
import { IsLocalizedText } from './is-localized-text.validator';
import { IsUuidLike } from '../../../core';

export class UpdateProductDto {
  @IsOptional()
  @IsUuidLike()
  categoryId?: string;

  @IsOptional()
  @IsLocalizedText()
  name?: Record<string, string>;

  @IsOptional()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsOptional()
  @IsInt()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availability?: AvailabilityStatus;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  dietaryTagIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(1439)
  servedStartMinuteOfDay?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(1439)
  servedEndMinuteOfDay?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ServingWindowDto)
  servedWindows?: ServingWindowDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchAvailabilityDto)
  branchAvailability?: BranchAvailabilityDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMediaDto)
  media?: ProductMediaDto;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => VariantGroupDto)
  variantGroups?: VariantGroupDto[];
}
