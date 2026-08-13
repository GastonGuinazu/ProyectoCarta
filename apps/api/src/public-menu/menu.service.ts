import { Injectable } from '@nestjs/common';
import { TenantOrBranchNotFoundException } from '../core';
import { CatalogService } from '../catalog/catalog.service';
import type {
  CategoryTreeNode,
  ComboNode,
  PlatformCatalogs,
} from '../catalog/catalog.types';
import { EngagementService } from '../engagement/engagement.service';
import { MediaService } from '../media/media.service';
import type { BranchDetails } from '../tenant/branch/branch-details.type';
import { BranchService } from '../tenant/branch/branch.service';
import { applyActivePromotions } from './apply-active-promotions.util';
import { applyMediaUrls } from './apply-media-urls.util';

/**
 * Forma parcial de la respuesta del menú público (docs/api-contracts.md §3.5).
 * Incluye `branch`, `categories` (árbol completo con productos, variantes,
 * imágenes/WebAR ya resueltas y referencias de alérgenos/tags dietéticos),
 * `combos` (agrupaciones de productos vigentes en la sucursal, con su propia
 * imagen resuelta) y `catalogs` (resolución de esas referencias a
 * `Allergen`/`DietaryTag`, globales a la plataforma). Falta agregar `meta` y
 * `tenant.branding`, fuera del alcance de este ticket.
 */
export interface PublicMenuResponse {
  readonly branch: BranchDetails;
  readonly categories: readonly CategoryTreeNode[];
  readonly combos: readonly ComboNode[];
  readonly catalogs: PlatformCatalogs;
}

/**
 * `PublicMenuModule` no contiene lógica de negocio propia: solo orquesta los
 * servicios de lectura de los módulos de dominio (docs/backend-architecture.md
 * §2.3, punto 4). Hoy orquesta `TenantModule.BranchService`,
 * `CatalogModule.CatalogService`, `EngagementModule.EngagementService` y
 * `MediaModule.MediaService`.
 *
 * Dos "cruces" se hacen acá, en orden, cada uno una función pura que solo
 * recorre el árbol y delega la decisión en el dominio correspondiente:
 * 1. `applyMediaUrls`: reemplaza `imageUrl`/`images`/`webAr` (todavía en su
 *    valor vacío honesto al salir de `CatalogService`) por las URLs
 *    resueltas en batch por `MediaService.resolveMediaAssets` — ver la
 *    estrategia anti-N+1 explicada al usuario antes de este código.
 * 2. `applyActivePromotions`: reemplaza `activePromotion` usando el resolver
 *    de `EngagementService` (detalle de prioridad/especificidad/recencia en
 *    `engagement.service.ts`).
 * El orden entre ambos no importa: tocan campos disjuntos de cada nodo.
 */
@Injectable()
export class MenuService {
  constructor(
    private readonly branchService: BranchService,
    private readonly catalogService: CatalogService,
    private readonly engagementService: EngagementService,
    private readonly mediaService: MediaService,
  ) {}

  async getPublicMenu(branchId: string): Promise<PublicMenuResponse> {
    const branch = await this.branchService.getBranchDetails(branchId);
    if (!branch) {
      // No debería ocurrir en la práctica: el TenantResolutionGuard ya validó que
      // la Sucursal existe antes de llegar acá. Se mantiene por defensa en
      // profundidad (ej. la fila fue borrada entre la resolución del Guard y esta
      // llamada) y para no filtrar información sobre cuál paso falló.
      throw new TenantOrBranchNotFoundException();
    }

    // Fase 1: hay que conocer QUÉ `mediaAssetId`s referencia el catálogo
    // antes de poder pedirle a `MediaService` que los resuelva, así que esto
    // no puede ir en el mismo `Promise.all` que la resolución de medios.
    const [catalogResult, comboResult] = await Promise.all([
      this.catalogService.getFullCatalogForBranch(branchId),
      this.catalogService.getCombosForBranch(branchId),
    ]);

    // Batch único: se juntan TODOS los ids referenciados (categorías +
    // productos + combos) antes de llamar a `MediaService`, sin importar de
    // qué entidad vengan — es la clave de la estrategia anti-N+1.
    const allMediaAssetIds = [
      ...catalogResult.categoryImageAssetIds.values(),
      ...catalogResult.productPrimaryAssetIds.values(),
      ...comboResult.comboImageAssetIds.values(),
    ];

    // Fase 2: `getPlatformCatalogs`, `getActivePromotionsForBranch` y
    // `resolveMediaAssets` son independientes entre sí, así que se resuelven
    // en paralelo para minimizar la latencia total de la request.
    const [catalogs, promotionsResolver, resolvedMedia] = await Promise.all([
      this.catalogService.getPlatformCatalogs(),
      this.engagementService.getActivePromotionsForBranch(branchId),
      this.mediaService.resolveMediaAssets(allMediaAssetIds),
    ]);

    const catalogWithMedia = applyMediaUrls(
      catalogResult.categories,
      comboResult.combos,
      {
        categoryImageAssetIds: catalogResult.categoryImageAssetIds,
        productPrimaryAssetIds: catalogResult.productPrimaryAssetIds,
        comboImageAssetIds: comboResult.comboImageAssetIds,
      },
      resolvedMedia,
    );

    const catalogWithPromotions = applyActivePromotions(
      catalogWithMedia.categories,
      catalogWithMedia.combos,
      promotionsResolver,
    );

    return {
      branch,
      categories: catalogWithPromotions.categories,
      combos: catalogWithPromotions.combos,
      catalogs,
    };
  }
}
