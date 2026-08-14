import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { IsUuidLike } from '../../core';

export class PublicMenuEventDto {
  @IsIn(['scan', 'search', 'filter', 'ar', 'dwell'])
  kind!: 'scan' | 'search' | 'filter' | 'ar' | 'dwell';

  @IsUuidLike()
  sessionId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 80)
  query?: string;

  @IsOptional()
  @IsIn(['allergen', 'dietary'])
  filterKind?: 'allergen' | 'dietary';

  @IsOptional()
  @IsUuidLike()
  tagId?: string;

  @IsOptional()
  @IsUuidLike()
  productId?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86_400_000)
  durationMs?: number;
}
