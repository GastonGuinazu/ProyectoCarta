import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Script de seeding administrativo (docs/backend-architecture.md, excepción
 * explícita de .cursor/rules/01-global-architecture.mdc para archivos de
 * seed/testing nombrados como tales). Usa el `PrismaClient` normal, SIN la
 * extensión de aislamiento multi-tenant (`TENANT_PRISMA_CLIENT`): este script
 * corre fuera de cualquier request HTTP, no hay `TenantContext` en
 * `AsyncLocalStorage` para resolver, y de hecho necesita escribir el
 * `tenantId` explícitamente en cada fila (es la única capa que lo hace "a
 * mano" en todo el proyecto).
 *
 * Estrategia de idempotencia: "borrar el subárbol del Tenant de demo si ya
 * existe, después recrear todo con `create` plano" (no upsert por tabla).
 * Todo corre dentro de UNA transacción interactiva (`$transaction(async (tx)
 * => ...)`): si algo falla a mitad de camino, no queda estado parcial.
 *
 * Orden de borrado (hijo -> padre), ver `resetPreviousSeedData`: es
 * deliberadamente explícito, tabla por tabla, en vez de confiar en un solo
 * `tenant.delete()` que dispare cascadas automáticas. Motivo: conviven
 * `onDelete: Cascade` (casi todo cuelga de `Tenant`) con FKs `Restrict`:
 * `ComboItem.product -> Product`, `Product.category -> Category` y
 * `Category.parent -> Category`. En Postgres, cuando conviven cascadas y
 * restricciones sobre la misma tabla en una única sentencia, el orden de
 * disparo de triggers no está garantizado. Borrando explícitamente en el
 * orden correcto se evita ese riesgo por completo. El reset cubre también
 * tablas que el seed no crea (combos, analytics, usuarios del tenant) porque
 * el panel admin puede haber escrito filas sobre el mismo tenant demo.
 * `Allergen`/`DietaryTag`/`Plan` NUNCA se borran: son catálogo
 * global/compartido (y de hecho `ProductAllergen.allergen`/
 * `ProductDietaryTag.dietaryTag` son `onDelete: Restrict`: ni se podrían
 * borrar mientras un producto los referencie).
 *
 * IDs fijos como constantes (en vez de dejar que Prisma genere UUIDs
 * aleatorios): permite declarar todo el grafo de FKs por escrito, sin tener
 * que encadenar `await` para releer el id generado por el paso anterior.
 */

const prisma = new PrismaClient();

const TENANT_SLUG = 'don-luigi';

const PLAN_ID = '00000000-0000-0000-0000-0000000000f1';
const TENANT_ID = '00000000-0000-0000-0000-0000000000f2';
const BRANCH_ID = '00000000-0000-0000-0000-0000000000f3';
const PROMO_ID = '00000000-0000-0000-0000-0000000000f4';

const CATEGORY_IDS = {
  pizzas: '00000000-0000-0000-0000-0000000000c1',
  bebidas: '00000000-0000-0000-0000-0000000000c2',
} as const;

const PRODUCT_IDS = {
  muzzarella: '00000000-0000-0000-0000-0000000000d1',
  napolitana: '00000000-0000-0000-0000-0000000000d2',
  limonada: '00000000-0000-0000-0000-0000000000d3',
} as const;

const MEDIA_ASSET_IDS = {
  categoryPizzas: '00000000-0000-0000-0000-0000000000a1',
  categoryBebidas: '00000000-0000-0000-0000-0000000000a2',
  productMuzzarella: '00000000-0000-0000-0000-0000000000a3',
  productNapolitana: '00000000-0000-0000-0000-0000000000a4',
  productLimonada: '00000000-0000-0000-0000-0000000000a5',
} as const;

/** Objeto `{ "<códigoIdioma>": "<valor>" }` (features-spec.md §6), igual que en el resto del código de aplicación. */
function localizedText(es: string, en: string): Prisma.InputJsonValue {
  return { es, en };
}

/**
 * Imágenes mock vía placehold.co (no son URLs reales de Cloudinary/Supabase):
 * suficientes para ejercitar de punta a punta el pipeline de `MediaModule`
 * (MediaAsset -> ProcessedVariant -> URL resuelta) sin depender de un storage
 * real todavía.
 */
function placeholderVariantUrls(label: string) {
  const text = encodeURIComponent(label);
  return {
    thumbnailUrl: `https://placehold.co/300x300.png?text=${text}`,
    detailUrl: `https://placehold.co/1200x1200.png?text=${text}`,
  };
}

type TransactionClient = Prisma.TransactionClient;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'No ejecutar prisma/seed.ts en producción (crea el tenant demo Don Luigi). El catálogo de Plan/alérgenos va en la migración platform_catalog_piloto; el PLATFORM_ADMIN se crea a mano (docs/hosting.md).',
    );
  }

  await prisma.$transaction(
    async (tx) => {
      await resetPreviousSeedData(tx);

      const { taccId, lacteosId, veganoId } = await seedPlatformCatalogs(tx);
      await seedPlan(tx);
      await seedTenantAndBranch(tx);
      await seedMedia(tx);
      await seedCatalog(tx, { taccId, lacteosId, veganoId });
      await seedPromotion(tx);
    },
    // Bastantes inserts secuenciales (~25) en una sola transacción: el timeout
    // default de Prisma (5s) puede quedar corto en una máquina lenta.
    { timeout: 30_000 },
  );
}

/**
 * Si el Tenant de demo ya existe (corridas previas del script), borra todo su
 * subárbol en orden hijo -> padre antes de recrearlo desde cero. Si no
 * existe (primera corrida), no hace nada.
 */
async function resetPreviousSeedData(tx: TransactionClient): Promise<void> {
  const existingTenant = await tx.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });

  if (!existingTenant) {
    return;
  }

  const tenantId = existingTenant.id;

  await tx.interactionEvent.deleteMany({ where: { tenantId } });
  await tx.scanEvent.deleteMany({ where: { tenantId } });
  await tx.aggregatedMetric.deleteMany({ where: { tenantId } });
  await tx.qrCode.deleteMany({ where: { tenantId } });

  await tx.roleAssignment.deleteMany({ where: { tenantId } });
  await tx.user.deleteMany({ where: { tenantId } });

  await tx.happyHourProductTarget.deleteMany({ where: { tenantId } });
  await tx.happyHourCategoryTarget.deleteMany({ where: { tenantId } });
  await tx.happyHourComboTarget.deleteMany({ where: { tenantId } });
  await tx.happyHourBranch.deleteMany({ where: { tenantId } });
  await tx.happyHour.deleteMany({ where: { tenantId } });

  await tx.promoProductTarget.deleteMany({ where: { tenantId } });
  await tx.promoCategoryTarget.deleteMany({ where: { tenantId } });
  await tx.promoComboTarget.deleteMany({ where: { tenantId } });
  await tx.promoBranch.deleteMany({ where: { tenantId } });
  await tx.promo.deleteMany({ where: { tenantId } });

  await tx.comboItem.deleteMany({ where: { tenantId } });
  await tx.comboBranchAvailability.deleteMany({ where: { tenantId } });
  await tx.combo.deleteMany({ where: { tenantId } });

  await tx.productMedia.deleteMany({ where: { tenantId } });
  await tx.productAllergen.deleteMany({ where: { tenantId } });
  await tx.productDietaryTag.deleteMany({ where: { tenantId } });
  await tx.productBranchAvailability.deleteMany({ where: { tenantId } });
  await tx.variantOption.deleteMany({ where: { tenantId } });
  await tx.variantGroup.deleteMany({ where: { tenantId } });
  // ComboItem.product y Product.category son onDelete: Restrict.
  await tx.product.deleteMany({ where: { tenantId } });

  await tx.categoryBranchAvailability.deleteMany({ where: { tenantId } });
  await tx.category.updateMany({
    where: { tenantId },
    data: { parentId: null },
  });
  await tx.category.deleteMany({ where: { tenantId } });

  await tx.processedVariant.deleteMany({ where: { tenantId } });
  await tx.mediaAsset.deleteMany({ where: { tenantId } });
  await tx.branch.deleteMany({ where: { tenantId } });
  await tx.tenant.delete({ where: { id: tenantId } });
}

/**
 * Catálogo global de plataforma (features-spec.md §5.1-5.2): NO tiene
 * `tenantId`, se comparte entre todos los tenants. Se resuelve por `upsert`
 * sobre `code` (su clave de negocio real) en vez de por id fijo: si otro
 * seed/tenant ya los creó antes, se reutilizan tal cual sin duplicarlos.
 */
async function seedPlatformCatalogs(tx: TransactionClient) {
  const tacc = await tx.allergen.upsert({
    where: { code: 'TACC' },
    update: {},
    create: {
      code: 'TACC',
      name: localizedText('TACC (Gluten)', 'Gluten'),
      iconUrl: null,
    },
  });

  const lacteos = await tx.allergen.upsert({
    where: { code: 'LACTEOS' },
    update: {},
    create: {
      code: 'LACTEOS',
      name: localizedText('Lácteos', 'Dairy'),
      iconUrl: null,
    },
  });

  const vegano = await tx.dietaryTag.upsert({
    where: { code: 'VEGANO' },
    update: {},
    create: {
      code: 'VEGANO',
      name: localizedText('Vegano', 'Vegan'),
      iconUrl: null,
    },
  });

  return { taccId: tacc.id, lacteosId: lacteos.id, veganoId: vegano.id };
}

/** `Plan` no tiene clave de negocio natural (ni `code` ni `slug`): se fija por id constante. */
async function seedPlan(tx: TransactionClient): Promise<void> {
  await tx.plan.upsert({
    where: { id: PLAN_ID },
    update: {},
    create: {
      id: PLAN_ID,
      name: 'Piloto',
      priceCents: 0,
      currency: 'ARS',
      billingPeriod: 'MONTHLY',
      maxBranches: 3,
      maxProducts: 100,
      maxStorageMb: 1024,
      maxLanguages: 2,
      webArEnabled: true,
      rateLimitPerMinute: 120,
    },
  });
}

async function seedTenantAndBranch(tx: TransactionClient): Promise<void> {
  await tx.tenant.create({
    data: {
      id: TENANT_ID,
      slug: TENANT_SLUG,
      name: 'Don Luigi',
      defaultLanguage: 'es',
      status: 'ACTIVE',
      planId: PLAN_ID,
      brandPrimaryColor: '#C0272D',
    },
  });

  await tx.branch.create({
    data: {
      id: BRANCH_ID,
      tenantId: TENANT_ID,
      slug: 'centro',
      name: 'Centro',
      address: 'Av. Corrientes 1234, CABA',
      phone: '+54 11 4000-0000',
      whatsapp: '+54 9 11 4000-0000',
      timezone: 'America/Argentina/Buenos_Aires',
      operationalStatus: 'OPEN',
    },
  });
}

/**
 * Crea los `MediaAsset` + sus `ProcessedVariant` (THUMBNAIL/DETAIL) ANTES de
 * Categorías/Productos, para poder engancharlos por `imageMediaAssetId`/
 * `ProductMedia` en un solo paso, sin un `update` posterior.
 */
async function seedMedia(tx: TransactionClient): Promise<void> {
  const assets: ReadonlyArray<{ id: string; label: string }> = [
    { id: MEDIA_ASSET_IDS.categoryPizzas, label: 'Pizzas' },
    { id: MEDIA_ASSET_IDS.categoryBebidas, label: 'Bebidas' },
    { id: MEDIA_ASSET_IDS.productMuzzarella, label: 'Pizza Muzzarella' },
    { id: MEDIA_ASSET_IDS.productNapolitana, label: 'Pizza Napolitana' },
    { id: MEDIA_ASSET_IDS.productLimonada, label: 'Limonada' },
  ];

  for (const asset of assets) {
    const { thumbnailUrl, detailUrl } = placeholderVariantUrls(asset.label);

    await tx.mediaAsset.create({
      data: {
        id: asset.id,
        tenantId: TENANT_ID,
        fileType: 'IMAGE',
        originalUrl: detailUrl,
        fileSizeBytes: 42_000,
        pipelineStatus: 'READY',
        processedVariants: {
          create: [
            {
              tenantId: TENANT_ID,
              purpose: 'THUMBNAIL',
              format: 'PNG',
              width: 300,
              height: 300,
              url: thumbnailUrl,
            },
            {
              tenantId: TENANT_ID,
              purpose: 'DETAIL',
              format: 'PNG',
              width: 1200,
              height: 1200,
              url: detailUrl,
            },
          ],
        },
      },
    });
  }
}

interface PlatformCatalogIds {
  readonly taccId: string;
  readonly lacteosId: string;
  readonly veganoId: string;
}

async function seedCatalog(tx: TransactionClient, catalogIds: PlatformCatalogIds): Promise<void> {
  await tx.category.create({
    data: {
      id: CATEGORY_IDS.pizzas,
      tenantId: TENANT_ID,
      slug: 'pizzas',
      name: localizedText('Pizzas', 'Pizzas'),
      description: localizedText('Pizzas al horno de leña', 'Wood-fired pizzas'),
      imageMediaAssetId: MEDIA_ASSET_IDS.categoryPizzas,
      order: 0,
    },
  });

  await tx.category.create({
    data: {
      id: CATEGORY_IDS.bebidas,
      tenantId: TENANT_ID,
      slug: 'bebidas',
      name: localizedText('Bebidas', 'Drinks'),
      description: localizedText('Bebidas frías y calientes', 'Cold and hot drinks'),
      imageMediaAssetId: MEDIA_ASSET_IDS.categoryBebidas,
      order: 1,
    },
  });

  await tx.product.create({
    data: {
      id: PRODUCT_IDS.muzzarella,
      tenantId: TENANT_ID,
      categoryId: CATEGORY_IDS.pizzas,
      slug: 'pizza-muzzarella',
      name: localizedText('Pizza Muzzarella', 'Mozzarella Pizza'),
      description: localizedText(
        'Salsa de tomate, muzzarella y aceitunas',
        'Tomato sauce, mozzarella and olives',
      ),
      basePriceCents: 1_200_000,
      order: 0,
      media: {
        create: { tenantId: TENANT_ID, mediaAssetId: MEDIA_ASSET_IDS.productMuzzarella, role: 'PRIMARY', order: 0 },
      },
      allergens: {
        create: [
          { tenantId: TENANT_ID, allergenId: catalogIds.taccId },
          { tenantId: TENANT_ID, allergenId: catalogIds.lacteosId },
        ],
      },
    },
  });

  await tx.product.create({
    data: {
      id: PRODUCT_IDS.napolitana,
      tenantId: TENANT_ID,
      categoryId: CATEGORY_IDS.pizzas,
      slug: 'pizza-napolitana',
      name: localizedText('Pizza Napolitana', 'Napolitana Pizza'),
      description: localizedText(
        'Muzzarella, tomate fresco, ajo y albahaca',
        'Mozzarella, fresh tomato, garlic and basil',
      ),
      basePriceCents: 1_350_000,
      order: 1,
      media: {
        create: { tenantId: TENANT_ID, mediaAssetId: MEDIA_ASSET_IDS.productNapolitana, role: 'PRIMARY', order: 0 },
      },
    },
  });

  await tx.product.create({
    data: {
      id: PRODUCT_IDS.limonada,
      tenantId: TENANT_ID,
      categoryId: CATEGORY_IDS.bebidas,
      slug: 'limonada',
      name: localizedText('Limonada', 'Lemonade'),
      description: localizedText('Limonada casera con menta', 'Homemade lemonade with mint'),
      basePriceCents: 250_000,
      order: 0,
      media: {
        create: { tenantId: TENANT_ID, mediaAssetId: MEDIA_ASSET_IDS.productLimonada, role: 'PRIMARY', order: 0 },
      },
      dietaryTags: {
        create: [{ tenantId: TENANT_ID, dietaryTagId: catalogIds.veganoId }],
      },
    },
  });
}

/** 1 Promo activa (`startAt`/`endAt` ya vigentes hoy) aplicada directo sobre "Pizza Muzzarella". */
async function seedPromotion(tx: TransactionClient): Promise<void> {
  const now = new Date();
  const startAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const endAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await tx.promo.create({
    data: {
      id: PROMO_ID,
      tenantId: TENANT_ID,
      name: localizedText('20% OFF Pizza Muzzarella', '20% OFF Mozzarella Pizza'),
      description: localizedText('Promo de lanzamiento', 'Launch promo'),
      discountType: 'PERCENTAGE',
      discountPercentageBp: 2_000, // 2000 bp = 20.00%
      startAt,
      endAt,
      priority: 1,
      status: 'ACTIVE',
      availableInAllBranches: true,
      productTargets: {
        create: [{ tenantId: TENANT_ID, productId: PRODUCT_IDS.muzzarella }],
      },
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error('[prisma/seed] Falló el seeding:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
