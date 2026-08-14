import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { BranchOperationalStatus } from '@prisma/client';
import { IsIanaTimeZone } from '../is-iana-time-zone.validator';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function emptyToNull(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * PATCH `/api/v1/admin/settings/branch`.
 * `logoUrl`/`bannerUrl` no se aceptan: se actualizan solo por upload.
 */
export class UpdateBranchSettingsDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  commercialName?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(40)
  whatsapp?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(255)
  instagram?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed.toUpperCase();
  })
  @Matches(HEX_COLOR, {
    message: 'El color debe ser un HEX de 6 dígitos (ej. #C0272D).',
  })
  accentColor?: string | null;

  @IsOptional()
  @IsEnum(BranchOperationalStatus)
  operationalStatus?: BranchOperationalStatus;

  @IsOptional()
  @IsString()
  @IsIanaTimeZone()
  timezone?: string;
}
