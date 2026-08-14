import { MediaFileType } from '@prisma/client';
import {
  MediaFileTooLargeException,
  UnsupportedMediaFileException,
} from './media.exceptions';

export type MediaUploadKind = 'image' | 'model3d';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MODEL_EXTENSIONS = new Set(['.glb', '.usdz']);

export interface ClassifiedUploadFile {
  readonly kind: MediaUploadKind;
  readonly fileType: MediaFileType;
  readonly extension: string;
}

/**
 * Clasifica por extensión (fuente de verdad). Los MIME de .glb/.usdz varían
 * según el SO, así que no se usan como criterio de rechazo.
 */
export function classifyUploadFile(originalName: string): ClassifiedUploadFile {
  const extension = extensionOf(originalName);
  if (IMAGE_EXTENSIONS.has(extension)) {
    return { kind: 'image', fileType: MediaFileType.IMAGE, extension };
  }
  if (MODEL_EXTENSIONS.has(extension)) {
    return { kind: 'model3d', fileType: MediaFileType.MODEL_3D, extension };
  }
  throw new UnsupportedMediaFileException();
}

export function assertFileSize(
  kind: MediaUploadKind,
  sizeBytes: number,
  imageMaxBytes: number,
  modelMaxBytes: number,
): void {
  const maxBytes = kind === 'image' ? imageMaxBytes : modelMaxBytes;
  if (sizeBytes > maxBytes) {
    throw new MediaFileTooLargeException(kind, maxBytes);
  }
}

export function extensionOf(originalName: string): string {
  const lastDot = originalName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === originalName.length - 1) {
    return '';
  }
  return originalName.slice(lastDot).toLowerCase();
}
