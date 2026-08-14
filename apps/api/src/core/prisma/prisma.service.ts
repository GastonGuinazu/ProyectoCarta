import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma "crudo" (sin la extensión de aislamiento multi-tenant), gestionado
 * con el ciclo de vida de Nest. Es intencionalmente el único lugar autorizado a
 * consultar el modelo `Tenant` (resolución por slug), ya que esa es la única
 * operación legítima que debe poder ocurrir sin un `tenant_id` previo
 * (docs/backend-architecture.md §4.2, Paso 2). También lo usan `AuthModule` /
 * `UserRepository` para lookup por email (antes de `TenantContext`) y persistencia
 * de `RefreshToken` (modelo no tenant-scoped).
 *
 * Ningún Repository de una entidad de negocio debe inyectar esta clase directamente:
 * deben inyectar el cliente extendido expuesto vía `TENANT_PRISMA_CLIENT`
 * (ver `tenant-prisma-client.provider.ts`).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexión a PostgreSQL vía Prisma establecida.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
