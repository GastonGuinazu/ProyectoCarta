import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un handler/controller como público respecto de `JwtAuthGuard`
 * (login, menú público). No desactiva `TenantResolutionGuard`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
