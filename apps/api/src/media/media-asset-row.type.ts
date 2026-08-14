import type { MediaFileType, MediaVariantPurpose } from '@prisma/client';

/**
 * `ProcessedVariant` cruda de un `MediaAsset` (`domain-modules.md` §5.2:
 * thumbnail de grilla, imagen de detalle estándar, recorte AR con canal
 * alfa). Puede haber más de una fila con el mismo `purpose` para el mismo
 * asset (ej. reprocesamientos): `MediaService` decide cuál es la "vigente"
 * (ver `pickLatestVariantUrl`), este Repository no filtra ni ordena por eso.
 */
export interface ProcessedVariantRow {
  readonly purpose: MediaVariantPurpose;
  readonly url: string;
  readonly createdAt: Date;
}

export interface MediaAssetRow {
  readonly id: string;
  readonly fileType: MediaFileType;
  readonly originalUrl: string;
  readonly variants: readonly ProcessedVariantRow[];
}
