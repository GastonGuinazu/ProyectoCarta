import { MediaFileType } from '@prisma/client';
import {
  MediaFileTooLargeException,
  UnsupportedMediaFileException,
} from './media.exceptions';

export type MediaUploadKind = 'image' | 'model3d';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp']);
const MODEL_EXTENSIONS = new Set(['.glb', '.usdz']);

const IMAGE_MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/jfif': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface ClassifiedUploadFile {
  readonly kind: MediaUploadKind;
  readonly fileType: MediaFileType;
  readonly extension: string;
}

/**
 * Clasifica por extensión (fuente de verdad). `.jfif` es JPEG (Windows /
 * descargas). Si la extensión no alcanza, se usa el MIME (`image/jpeg` de
 * fotos de celular). Los MIME de .glb/.usdz varían según el SO, así que no
 * se usan como criterio de rechazo.
 */
export function classifyUploadFile(
  originalName: string,
  mimeType?: string,
): ClassifiedUploadFile {
  const extension = extensionOf(originalName);
  if (IMAGE_EXTENSIONS.has(extension)) {
    return { kind: 'image', fileType: MediaFileType.IMAGE, extension };
  }
  if (MODEL_EXTENSIONS.has(extension)) {
    return { kind: 'model3d', fileType: MediaFileType.MODEL_3D, extension };
  }

  const mime = mimeType?.split(';')[0]?.trim().toLowerCase() ?? '';
  const fromMime = IMAGE_MIME_TO_EXTENSION[mime];
  if (fromMime) {
    return { kind: 'image', fileType: MediaFileType.IMAGE, extension: fromMime };
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
