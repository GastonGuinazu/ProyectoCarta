import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

import { IsUuidLike } from '../../../core';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (value === '' || value === null) {
    return undefined;
  }
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateBranchDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 120)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'El slug de la sucursal solo admite minúsculas, números y guiones.',
  })
  @Length(2, 80)
  slug!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUuidLike()
  copyCatalogFromBranchId?: string;
}
