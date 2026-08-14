import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { AdminBranchBrandingController } from './admin-branch-branding.controller';
import { AdminComboMediaController } from './admin-combo-media.controller';
import { AdminProductMediaController } from './admin-product-media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { SupabaseStorageService } from './supabase-storage.service';

/**
 * `PrismaService`/`TENANT_PRISMA_CLIENT` y `TenantContextService` ya están
 * registrados globalmente por `CoreModule` (`@Global()`); este módulo no los
 * vuelve a declarar, solo los inyecta (mismo patrón que `CatalogModule`).
 *
 * Importa `TenantModule` para cuota de almacenamiento (`Plan.maxStorageMb`).
 */
@Module({
  imports: [TenantModule],
  controllers: [
    AdminProductMediaController,
    AdminComboMediaController,
    AdminBranchBrandingController,
  ],
  providers: [MediaRepository, MediaService, SupabaseStorageService],
  exports: [MediaService],
})
export class MediaModule {}
