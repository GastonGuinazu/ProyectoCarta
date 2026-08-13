import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../core';
import type { MediaVariantPurpose } from '@prisma/client';
import type { MediaAssetRow, ProcessedVariantRow } from './media-asset-row.type';
import { MediaRepository } from './media.repository';
import type { ResolvedMediaAsset } from './media.types';

/**
 * Lógica de negocio del dominio Media & AR (docs/domain-modules.md §5,
 * docs/backend-architecture.md §2.1). Único punto de entrada para resolver
 * `mediaAssetId`s a URLs concretas por propósito.
 *
 * `resolveMediaAssets` está diseñado como un batch loader explícito: recibe
 * TODOS los ids que el caller necesite de una vez (sin importar de cuántas
 * entidades distintas de Catalog vengan) y hace una única consulta a la base
 * de datos (`MediaRepository.findByIds`) — ver la estrategia anti-N+1
 * explicada al usuario antes de este código. Quien llama debe juntar sus ids
 * en un solo array antes de invocar este método; este Service no reintenta
 * "una llamada por entidad".
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async resolveMediaAssets(
    assetIds: readonly string[],
  ): Promise<ReadonlyMap<string, ResolvedMediaAsset>> {
    const uniqueAssetIds = [...new Set(assetIds)];
    if (uniqueAssetIds.length === 0) {
      // Ni siquiera vale la pena golpear la base de datos: evita una consulta
      // vacía cuando el catálogo de la sucursal no referencia ninguna imagen
      // todavía (caso esperado en un tenant recién creado).
      return new Map();
    }

    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const assets = await this.mediaRepository.findByIds(tenantId, uniqueAssetIds);

    return new Map(assets.map((asset) => [asset.id, toResolvedMediaAsset(asset)]));
  }
}

function toResolvedMediaAsset(asset: MediaAssetRow): ResolvedMediaAsset {
  return {
    thumbnailUrl: pickLatestVariantUrl(asset.variants, 'THUMBNAIL'),
    detailUrl: pickLatestVariantUrl(asset.variants, 'DETAIL'),
    arCutoutUrl: pickLatestVariantUrl(asset.variants, 'AR_CUTOUT'),
  };
}

/**
 * Puede haber más de una `ProcessedVariant` con el mismo `purpose` para el
 * mismo asset (ej. un reprocesamiento tras corregir un error del pipeline de
 * IA); se toma la más reciente por `createdAt` como criterio determinístico
 * de desempate, análogo a la regla de recencia ya usada en
 * `engagement/promotion-candidate.ts`.
 */
function pickLatestVariantUrl(
  variants: readonly ProcessedVariantRow[],
  purpose: MediaVariantPurpose,
): string | null {
  let latest: ProcessedVariantRow | null = null;

  for (const variant of variants) {
    if (variant.purpose !== purpose) {
      continue;
    }
    if (!latest || variant.createdAt.getTime() > latest.createdAt.getTime()) {
      latest = variant;
    }
  }

  return latest?.url ?? null;
}
