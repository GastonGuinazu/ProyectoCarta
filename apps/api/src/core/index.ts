export { CoreModule } from './core.module';
export type { LocalizedText } from './types/localized-text.type';
export { TenantContextService } from './context/tenant-context.service';
export type { TenantContext } from './context/tenant-context.types';
export { PrismaService } from './prisma/prisma.service';
export {
  TENANT_PRISMA_CLIENT,
  type TenantScopedPrismaClient,
} from './prisma/tenant-prisma-client.provider';
export {
  TENANT_SCOPED_MODELS,
  isTenantScopedModel,
} from './prisma/tenant-scoped-models';
export { SkipTenantResolution } from './decorators/skip-tenant-resolution.decorator';
export { CurrentTenant } from './decorators/current-tenant.decorator';
export type { TenantScopedRequest } from './http/tenant-scoped-request';
export { MissingTenantContextException } from './exceptions/missing-tenant-context.exception';
export {
  TenantOrBranchNotFoundException,
  TenantSuspendedException,
} from './exceptions/tenant-resolution.exceptions';
