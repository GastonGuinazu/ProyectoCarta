import type { Provider } from '@nestjs/common';
import { TenantContextService } from '../context/tenant-context.service';
import { createTenantIsolationExtension } from './prisma-tenant.extension';
import { PrismaService } from './prisma.service';

/** Token de inyección del cliente Prisma con aislamiento multi-tenant automático. */
export const TENANT_PRISMA_CLIENT = Symbol('TENANT_PRISMA_CLIENT');

export function buildTenantScopedPrismaClient(
  prisma: PrismaService,
  tenantContextService: TenantContextService,
) {
  return prisma.$extends(createTenantIsolationExtension(tenantContextService));
}

/** Tipo del cliente expuesto bajo `TENANT_PRISMA_CLIENT`, para inyectarlo con `@Inject`. */
export type TenantScopedPrismaClient = ReturnType<
  typeof buildTenantScopedPrismaClient
>;

/**
 * Provider factory: se construye una única vez (scope singleton por defecto) sobre
 * la misma instancia de `PrismaService`. La extensión lee el contexto activo en
 * cada llamada, así que no hay problema en crearla una sola vez al bootstrap.
 *
 * Todo Repository de una entidad de negocio multi-tenant debe inyectar este token,
 * nunca `PrismaService` directamente (docs/backend-architecture.md §4.2).
 */
export const tenantPrismaClientProvider: Provider = {
  provide: TENANT_PRISMA_CLIENT,
  useFactory: buildTenantScopedPrismaClient,
  inject: [PrismaService, TenantContextService],
};
