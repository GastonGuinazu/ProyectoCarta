/**
 * Tipos de foto 2D aceptados en panel (producto, combo, logo, portada).
 * No incluye modelos 3D (`.glb` / `.usdz`). `.jfif` es JPEG (Windows).
 * HEIC del iPhone no se acepta: hay que exportarlo como JPG.
 */
export const IMAGE_UPLOAD_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.jfif',
  '.png',
  '.webp',
]);

export const IMAGE_UPLOAD_MIME = new Set([
  'image/jpeg',
  'image/pjpeg',
  'image/jpg',
  'image/jfif',
  'image/png',
  'image/webp',
]);

export const IMAGE_UPLOAD_ACCEPT =
  '.jpg,.jpeg,.jfif,.png,.webp,image/jpeg,image/png,image/webp';

export const IMAGE_UPLOAD_HINT =
  'JPG, JPEG, JFIF, PNG o WebP (10 MB). Las fotos del celular suelen ser JPG; si el iPhone guarda HEIC, exportala como JPG.';

export const IMAGE_UPLOAD_TYPE_ERROR =
  'La imagen acepta .jpg, .jpeg, .jfif, .png o .webp. Las fotos HEIC del iPhone hay que guardarlas como JPG.';

export function isAcceptedImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const lastDot = name.lastIndexOf('.');
  const extension = lastDot >= 0 ? name.slice(lastDot) : '';
  return (
    IMAGE_UPLOAD_EXTENSIONS.has(extension) || IMAGE_UPLOAD_MIME.has(file.type)
  );
}
