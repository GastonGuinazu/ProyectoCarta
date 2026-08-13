import { Prisma } from '@prisma/client';
import type { TenantContextService } from '../context/tenant-context.service';
import { isTenantScopedModel } from './tenant-scoped-models';

type PlainRecord = Record<string, unknown>;

const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const WHERE_MUTATION_OPERATIONS = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/**
 * Capa 2 de la defensa en profundidad de aislamiento multi-tenant
 * (docs/backend-architecture.md §4.2): intercepta toda operación de Prisma sobre un
 * modelo "tenant-scoped" (ver `tenant-scoped-models.ts`) e inyecta/verifica
 * `tenant_id` a partir del `TenantContext` activo en `AsyncLocalStorage`, sin que el
 * Service/Repository que originó la llamada tenga que hacerlo explícito.
 *
 * Comportamiento fail-closed: si no hay contexto activo, `tenantContextService`
 * lanza `MissingTenantContextException` antes de que la query llegue a Postgres.
 *
 * Nota: esto NO cubre *nested writes* (ej. `product.create({ data: { variantGroups:
 * { create: [...] } } })`), porque Prisma no las expone como operaciones de modelo
 * de primer nivel interceptables por esta extensión. Esos casos siguen dependiendo
 * de la Capa 1 (tenantId explícito en el Repository) y de la futura Capa 3 (RLS).
 */
export function createTenantIsolationExtension(
  tenantContextService: TenantContextService,
) {
  return Prisma.defineExtension({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isTenantScopedModel(model)) {
            return query(args);
          }

          const tenantId = tenantContextService.getTenantIdOrThrow(model);

          if (
            READ_OPERATIONS.has(operation) ||
            WHERE_MUTATION_OPERATIONS.has(operation)
          ) {
            const typedArgs = args as { where?: PlainRecord };
            typedArgs.where = { ...typedArgs.where, tenantId };
          }

          if (operation === 'create') {
            const typedArgs = args as { data: PlainRecord };
            // Siempre se fuerza al tenantId del contexto activo, incluso si el
            // caller ya incluía uno: nunca se confía en un tenantId de negocio
            // que no provenga del contexto resuelto por el Guard.
            typedArgs.data = { ...typedArgs.data, tenantId };
          }

          if (operation === 'createMany') {
            const typedArgs = args as { data: PlainRecord[] | PlainRecord };
            typedArgs.data = Array.isArray(typedArgs.data)
              ? typedArgs.data.map((item) => ({ ...item, tenantId }))
              : { ...typedArgs.data, tenantId };
          }

          if (operation === 'upsert') {
            const typedArgs = args as {
              where?: PlainRecord;
              create: PlainRecord;
              update?: PlainRecord;
            };
            typedArgs.where = { ...typedArgs.where, tenantId };
            typedArgs.create = { ...typedArgs.create, tenantId };
            if (typedArgs.update) {
              // Un update nunca debe poder "mover" una fila a otro tenant.
              typedArgs.update = { ...typedArgs.update, tenantId };
            }
          }

          if (operation === 'update' || operation === 'updateMany') {
            const typedArgs = args as { data: PlainRecord };
            if (typedArgs.data && 'tenantId' in typedArgs.data) {
              typedArgs.data = { ...typedArgs.data, tenantId };
            }
          }

          return query(args);
        },
      },
    },
  });
}
