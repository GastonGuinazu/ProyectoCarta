import { Prisma } from '@prisma/client';

/**
 * Modelos de `prisma/schema.prisma` que cuelgan, directa o indirectamente, de un
 * Tenant (tienen columna `tenant_id`). Es la lista exacta sobre la que actúa la
 * extensión de aislamiento (docs/backend-architecture.md §4.2, Paso 2).
 *
 * Deliberadamente EXCLUIDOS (no tienen `tenantId` en el schema, o no son de negocio):
 * - `Plan`: catálogo de planes de suscripción, global a la plataforma.
 * - `Tenant`: es la raíz de la jerarquía; resolverlo por `slug` es la única
 *   operación legítima sin `tenant_id` previo (la hace el propio Guard).
 * - `Allergen`, `DietaryTag`: catálogos estandarizados globales a la plataforma
 *   (features-spec.md §5.1-5.2).
 * - `RefreshToken`: sesión de AuthModule; cuelga de `User`, no de Tenant.
 *
 * Si se agrega un modelo nuevo con `tenantId` al schema, hay que agregarlo aquí
 * también: no hay forma de derivarlo automáticamente sin inspeccionar el DMMF en
 * runtime, y prefer mantener esta lista explícita y auditable.
 */
export const TENANT_SCOPED_MODELS: ReadonlySet<Prisma.ModelName> =
  new Set<Prisma.ModelName>([
    'User',
    'RoleAssignment',
    'Branch',
    'QrCode',
    'Category',
    'CategoryBranchAvailability',
    'Product',
    'ProductBranchAvailability',
    'VariantGroup',
    'VariantOption',
    'Combo',
    'ComboItem',
    'ComboBranchAvailability',
    'ProductAllergen',
    'ProductDietaryTag',
    'Promo',
    'PromoProductTarget',
    'PromoCategoryTarget',
    'PromoComboTarget',
    'PromoBranch',
    'HappyHour',
    'HappyHourProductTarget',
    'HappyHourCategoryTarget',
    'HappyHourComboTarget',
    'HappyHourBranch',
    'MediaAsset',
    'ProcessedVariant',
    'ProductMedia',
    'ScanEvent',
    'InteractionEvent',
    'AggregatedMetric',
  ]);

export function isTenantScopedModel(
  model: string | undefined,
): model is Prisma.ModelName {
  return !!model && TENANT_SCOPED_MODELS.has(model as Prisma.ModelName);
}
