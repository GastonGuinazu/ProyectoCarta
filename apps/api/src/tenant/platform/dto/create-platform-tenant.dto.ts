import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreatePlatformTenantDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  commercialName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'El slug del restaurante solo admite minúsculas, números y guiones.',
  })
  @Length(2, 80)
  tenantSlug!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  branchName?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'El slug de la sucursal solo admite minúsculas, números y guiones.',
  })
  @Length(2, 80)
  branchSlug!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  ownerFullName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsString()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  ownerPassword!: string;
}
