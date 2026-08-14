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
import type { PublicTenantBranding } from '../tenant/settings/admin-settings.types';
import { TenantService } from '../tenant/tenant.service';
import { applyActivePromotions } from './apply-active-promotions.util';
import { applyMediaUrls } from './apply-media-urls.util';
import { applyServingHours } from './apply-serving-hours.util';

/**
 * Forma de la respuesta del menú público (docs/api-contracts.md §3.5).
 * Incluye `tenant.branding`, `branch`, catálogo y combos.
 */
export interface PublicMenuResponse {
  readonly tenant: PublicTenantBranding;
  readonly branch: BranchDetails;
  readonly categories: readonly CategoryTreeNode[];
  readonly combos: readonly ComboNode[];
  readonly catalogs: PlatformCatalogs;
}

@Injectable()
export class MenuService {
  constructor(
    private readonly branchService: BranchService,
    private readonly tenantService: TenantService,
    private readonly catalogService: CatalogService,
    private readonly engagementService: EngagementService,
    private readonly mediaService: MediaService,
  ) {}

  async getPublicMenu(
    tenantId: string,
    branchId: string,
  ): Promise<PublicMenuResponse> {
    const [branch, tenant] = await Promise.all([
      this.branchService.getBranchDetails(branchId),
      this.tenantService.findPublicBranding(tenantId),
    ]);
    if (!branch || !tenant) {
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
      ...catalogResult.productArModelAssetIds.values(),
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
        productArModelAssetIds: catalogResult.productArModelAssetIds,
        comboImageAssetIds: comboResult.comboImageAssetIds,
      },
      resolvedMedia,
    );

    const catalogWithPromotions = applyActivePromotions(
      catalogWithMedia.categories,
      catalogWithMedia.combos,
      promotionsResolver,
    );

    const categories = applyServingHours(
      catalogWithPromotions.categories,
      branch.timezone,
      new Date(),
    );

    return {
      tenant,
      branch,
      categories,
      combos: catalogWithPromotions.combos,
      catalogs,
    };
  }
}
