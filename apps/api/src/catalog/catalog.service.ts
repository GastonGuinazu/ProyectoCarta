import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../core';
import { buildCategoryTree } from './category-tree.builder';
import { CategoryRepository } from './category/category.repository';
import { ComboRepository } from './combo/combo.repository';
import type { ComboRow } from './combo/combo-row.type';
import { PlatformCatalogRepository } from './platform-catalog.repository';
import { ProductRepository } from './product/product.repository';
import type {
  CategoryTreeNode,
  ComboItemRefNode,
  ComboNode,
  PlatformCatalogs,
} from './catalog.types';

/**
 * Referencias crudas a `MediaAsset` recolectadas junto con el árbol de
 * categorías, en la MISMA pasada sobre las filas que ya se usan para armar
 * `CategoryTreeNode[]` — sin queries adicionales. Nunca se serializan
 * directamente en la respuesta pública: son la entrada del batch que
 * `MenuService` le pasa a `MediaService.resolveMediaAssets` (ver
 * `public-menu/apply-media-urls.util.ts`), que es quien realmente puebla
 * `imageUrl`/`images`/`webAr`.
 */
export interface CategoryTreeResult {
  readonly categories: readonly CategoryTreeNode[];
  readonly categoryImageAssetIds: ReadonlyMap<string, string>;
  readonly productPrimaryAssetIds: ReadonlyMap<string, string>;
}

export interface ComboListResult {
  readonly combos: readonly ComboNode[];
  readonly comboImageAssetIds: ReadonlyMap<string, string>;
}

/**
 * Lógica de negocio del dominio Catalog (docs/domain-modules.md §3,
 * docs/backend-architecture.md §2.1). Orquesta los Repositories de Categoría,
 * Producto, Combo y catálogos globales de plataforma (Alérgenos/Tags
 * dietéticos), y arma el árbol anidado con la herencia de
 * visibilidad/disponibilidad ya resuelta (ver `category-tree.builder.ts`).
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly productRepository: ProductRepository,
    private readonly comboRepository: ComboRepository,
    private readonly platformCatalogRepository: PlatformCatalogRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * `tenantId` no se recibe como parámetro: se toma del `TenantContext` activo
   * en `AsyncLocalStorage` (ya resuelto por `TenantResolutionGuard` para esta
   * request), preservando la firma de un solo parámetro pedida. Los
   * Repositories, en cambio, sí reciben `tenantId` explícito (Capa 1 de
   * defensa en profundidad, .cursor/rules/03-backend-nestjs.mdc).
   */
  async getFullCatalogForBranch(
    branchId: string,
  ): Promise<CategoryTreeResult> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();

    const [categories, products] = await Promise.all([
      this.categoryRepository.findAllForTenant(tenantId, branchId),
      this.productRepository.findAvailableForBranch(tenantId, branchId),
    ]);

    return {
      categories: buildCategoryTree(categories, products),
      categoryImageAssetIds: collectAssetIdsById(
        categories,
        (category) => category.imageMediaAssetId,
      ),
      productPrimaryAssetIds: collectAssetIdsById(
        products,
        (product) => product.primaryMediaAssetId,
      ),
    };
  }

  /**
   * A diferencia de `getFullCatalogForBranch`, un Combo no tiene jerarquía ni
   * herencia que resolver: el mapeo `ComboRow -> ComboNode` es una
   * transformación 1:1 (recortar `items[].product` al par
   * `productId`/`quantity` que exige el contrato público), por lo que no
   * amerita un builder aparte como `category-tree.builder.ts`.
   */
  async getCombosForBranch(branchId: string): Promise<ComboListResult> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();

    const combos = await this.comboRepository.findAvailableForBranch(
      tenantId,
      branchId,
    );

    return {
      combos: combos.map(toComboNode),
      comboImageAssetIds: collectAssetIdsById(
        combos,
        (combo) => combo.imageMediaAssetId,
      ),
    };
  }

  /**
   * Globales a la plataforma: no dependen de `tenantId` ni de `branchId`
   * (ver `PlatformCatalogRepository`). Se resuelven igual en cada request del
   * menú público en vez de cachearse acá: son tablas pequeñas y de bajo
   * volumen de escritura, y cachearlas queda fuera del alcance de este
   * ticket.
   */
  async getPlatformCatalogs(): Promise<PlatformCatalogs> {
    const [allergens, dietaryTags] = await Promise.all([
      this.platformCatalogRepository.findAllAllergens(),
      this.platformCatalogRepository.findAllDietaryTags(),
    ]);

    return {
      allergens: allergens.map((allergen) => ({
        id: allergen.id,
        code: allergen.code,
        name: allergen.name,
        iconUrl: allergen.iconUrl,
      })),
      dietaryTags: dietaryTags.map((dietaryTag) => ({
        id: dietaryTag.id,
        code: dietaryTag.code,
        name: dietaryTag.name,
        iconUrl: dietaryTag.iconUrl,
      })),
    };
  }
}

function toComboNode(combo: ComboRow): ComboNode {
  return {
    id: combo.id,
    slug: combo.slug,
    name: combo.name,
    description: combo.description,
    price: combo.priceCents,
    currency: combo.currency,
    imageUrl: null,
    availability: combo.availability,
    items: combo.items.map(toComboItemRefNode),
    activePromotion: null,
  };
}

function toComboItemRefNode(item: ComboRow['items'][number]): ComboItemRefNode {
  return {
    productId: item.productId,
    quantity: item.quantity,
  };
}

/**
 * Recolecta `entidad.id -> mediaAssetId` en una sola pasada O(n) sobre filas
 * que `CatalogService` ya tiene en memoria (no dispara ninguna consulta
 * nueva). Omite las entidades sin asset configurado: el `Map` resultante
 * solo contiene referencias que efectivamente hay que resolver, minimizando
 * el batch que después recibe `MediaService.resolveMediaAssets`.
 */
function collectAssetIdsById<T extends { readonly id: string }>(
  rows: readonly T[],
  getAssetId: (row: T) => string | null,
): ReadonlyMap<string, string> {
  const assetIdsById = new Map<string, string>();

  for (const row of rows) {
    const assetId = getAssetId(row);
    if (assetId) {
      assetIdsById.set(row.id, assetId);
    }
  }

  return assetIdsById;
}
