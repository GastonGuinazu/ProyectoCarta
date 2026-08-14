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
export { SkipTenantContext } from './decorators/skip-tenant-context.decorator';
export { RequireTenantContext } from './decorators/require-tenant-context.decorator';
export { Public, IS_PUBLIC_KEY } from './decorators/public.decorator';
export { CurrentTenant } from './decorators/current-tenant.decorator';
export type { TenantScopedRequest } from './http/tenant-scoped-request';
export { MissingTenantContextException } from './exceptions/missing-tenant-context.exception';
export {
  TenantOrBranchNotFoundException,
  TenantSuspendedException,
} from './exceptions/tenant-resolution.exceptions';
export { IsUuidLike } from './validation/is-uuid-like.validator';
export { ParseUuidLikePipe } from './pipes/parse-uuid-like.pipe';
export { isUuidLike, UUID_LIKE_RE } from './validation/uuid-like';
