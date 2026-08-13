import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextService } from './context/tenant-context.service';
import { TenantResolutionGuard } from './guards/tenant-resolution.guard';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';
import { PrismaService } from './prisma/prisma.service';
import {
  TENANT_PRISMA_CLIENT,
  tenantPrismaClientProvider,
} from './prisma/tenant-prisma-client.provider';

/**
 * Módulo global de infraestructura que implementa la capa base de aislamiento
 * multi-tenant descrita en docs/backend-architecture.md §3–4:
 *
 * - `TenantContextService`: contexto de tenant/sucursal vía `AsyncLocalStorage`.
 * - `PrismaService`: cliente Prisma "crudo" (solo para resolver `Tenant` por slug).
 * - `TENANT_PRISMA_CLIENT`: cliente Prisma extendido con inyección automática de
 *   `tenantId` (Capa 2 de defensa en profundidad) — este es el que deben inyectar
 *   los Repositories de entidades de negocio.
 * - `TenantResolutionGuard` (global, `APP_GUARD`): resuelve el tenant/sucursal por
 *   slug de ruta y lo adjunta a la request.
 * - `TenantContextInterceptor` (global, `APP_INTERCEPTOR`): abre el
 *   `AsyncLocalStorage` con ese contexto para el resto del pipeline.
 *
 * Al ser `@Global()`, ningún otro módulo de dominio necesita importar `CoreModule`
 * explícitamente para acceder a estos providers exportados; solo se importa una vez
 * en `AppModule`.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    TenantContextService,
    tenantPrismaClientProvider,
    { provide: APP_GUARD, useClass: TenantResolutionGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [PrismaService, TenantContextService, TENANT_PRISMA_CLIENT],
})
export class CoreModule {}
