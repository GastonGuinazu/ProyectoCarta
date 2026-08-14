import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (value === '' || value === null) {
    return undefined;
  }
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateBranchDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === '' || value === null) {
      return undefined;
    }
    return typeof value === 'string' ? value.trim().toLowerCase() : value;
  })
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'El slug de la sucursal solo admite minúsculas, números y guiones.',
  })
  @Length(2, 80)
  slug?: string;
}
