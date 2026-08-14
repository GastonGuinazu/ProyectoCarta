import { IsEnum } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class UpdatePlatformTenantStatusDto {
  @IsEnum(TenantStatus)
  status!: TenantStatus;
}
