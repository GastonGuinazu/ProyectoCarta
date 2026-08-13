import { Inject, Injectable } from '@nestjs/common';
import {
  TENANT_PRISMA_CLIENT,
  type TenantScopedPrismaClient,
} from '../core';
import type { MediaAssetRow } from './media-asset-row.type';

/**
 * Única capa autorizada a hablar con Prisma para `MediaAsset`/`ProcessedVariant`
 * (.cursor/rules/03-backend-nestjs.mdc). Inyecta `TENANT_PRISMA_CLIENT`
 * (Capa 2 de aislamiento), y pasa `tenantId` explícito en el `where` (Capa 1).
 */
@Injectable()
export class MediaRepository {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: TenantScopedPrismaClient,
  ) {}

  /**
   * Resuelve TODOS los `assetIds` pedidos en una única consulta (`id: { in: [...] }`)
   * con sus `ProcessedVariant` incluidas vía `include` — es la pieza clave de la
   * estrategia anti-N+1 explicada al usuario: sin importar cuántas
   * categorías/productos/combos referencien imágenes, esta es la ÚNICA
   * consulta a la base de datos que `MediaModule` ejecuta por request de menú
   * público (ver `MediaService.resolveMediaAssets`, que es quien deduplica y
   * arma el batch antes de llamar acá).
   */
  async findByIds(
    tenantId: string,
    assetIds: readonly string[],
  ): Promise<readonly MediaAssetRow[]> {
    if (assetIds.length === 0) {
      return [];
    }

    const assets = await this.prisma.mediaAsset.findMany({
      where: { tenantId, id: { in: assetIds as string[] } },
      include: {
        processedVariants: {
          select: { purpose: true, url: true, createdAt: true },
        },
      },
    });

    return assets.map((asset) => ({
      id: asset.id,
      variants: asset.processedVariants,
    }));
  }
}
