import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
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
import { VariantSelectionType, AvailabilityStatus } from '@prisma/client';
import { IsUuidLike } from '../../../core';
import { IsLocalizedText } from './is-localized-text.validator';

export enum BranchAvailabilityMode {
  ALL_BRANCHES = 'ALL_BRANCHES',
  SPECIFIC_BRANCHES = 'SPECIFIC_BRANCHES',
}

export class BranchAvailabilityDto {
  @IsEnum(BranchAvailabilityMode)
  mode!: BranchAvailabilityMode;

  @IsArray()
  @IsUUID('4', { each: true })
  @ValidateIf(
    (dto: BranchAvailabilityDto) =>
      dto.mode === BranchAvailabilityMode.SPECIFIC_BRANCHES,
  )
  @ArrayNotEmpty()
  branchIds: string[] = [];
}

export class ProductMediaArDto {
  @IsBoolean()
  enabled!: boolean;

  @ValidateIf((dto: ProductMediaArDto) => dto.enabled)
  @IsUUID('4')
  sourceMediaAssetId?: string;
}

export class ProductMediaDto {
  @IsUUID('4')
  primaryMediaAssetId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  galleryMediaAssetIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMediaArDto)
  ar?: ProductMediaArDto;
}

export class VariantOptionDto {
  @IsLocalizedText()
  name!: Record<string, string>;

  @IsInt()
  @Min(0)
  priceDelta!: number;
}

export class VariantGroupDto {
  @IsLocalizedText()
  name!: Record<string, string>;

  @IsEnum(VariantSelectionType)
  selectionType!: VariantSelectionType;

  @IsBoolean()
  required!: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionDto)
  options!: VariantOptionDto[];
}

/** Body de `POST /api/v1/admin/catalog/products` (docs/api-contracts.md §5.3). */
export class CreateProductDto {
  @IsUuidLike()
  categoryId!: string;

  @IsLocalizedText()
  name!: Record<string, string>;

  @IsOptional()
  @IsLocalizedText()
  description?: Record<string, string>;

  @IsInt()
  @Min(0)
  basePrice!: number;

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
  @ValidateNested()
  @Type(() => BranchAvailabilityDto)
  branchAvailability?: BranchAvailabilityDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMediaDto)
  media?: ProductMediaDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantGroupDto)
  variantGroups?: VariantGroupDto[];
}
