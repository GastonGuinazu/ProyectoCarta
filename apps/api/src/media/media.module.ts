import { Module } from '@nestjs/common';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';

/**
 * `PrismaService`/`TENANT_PRISMA_CLIENT` y `TenantContextService` ya están
 * registrados globalmente por `CoreModule` (`@Global()`); este módulo no los
 * vuelve a declarar, solo los inyecta (mismo patrón que `CatalogModule`).
 */
@Module({
  providers: [MediaRepository, MediaService],
  exports: [MediaService],
})
export class MediaModule {}
