import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class LinkedProductNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'PRODUCT_NOT_FOUND',
      message: 'El producto no existe en este restaurante.',
    });
  }
}

export class LinkedComboNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'COMBO_NOT_FOUND',
      message: 'El combo no existe en este restaurante.',
    });
  }
}

export class LinkedBranchNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'BRANCH_NOT_FOUND',
      message: 'Este restaurante todavía no tiene una sucursal.',
    });
  }
}

export class MissingMediaFileException extends BadRequestException {
  constructor() {
    super({
      code: 'MISSING_FILE',
      message: 'Adjuntá un archivo en el campo file.',
    });
  }
}

export class UnsupportedMediaFileException extends BadRequestException {
  constructor() {
    super({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message:
        'Solo se aceptan imágenes (.jpg, .png, .webp) o modelos 3D (.glb, .usdz).',
    });
  }
}

export class MediaSlotTypeMismatchException extends BadRequestException {
  constructor(slot: 'presentation' | 'immersive') {
    super({
      code: 'MEDIA_SLOT_TYPE_MISMATCH',
      message:
        slot === 'presentation'
          ? 'La imagen de presentación solo acepta .jpg, .png o .webp.'
          : 'La experiencia inmersiva solo acepta modelos .glb o .usdz.',
    });
  }
}

export class MediaFileTooLargeException extends PayloadTooLargeException {
  constructor(kind: 'image' | 'model3d', maxBytes: number) {
    const label = kind === 'image' ? 'imágenes' : 'modelos 3D';
    super({
      code: 'MEDIA_FILE_TOO_LARGE',
      message: `El archivo supera el máximo de ${Math.floor(maxBytes / (1024 * 1024))} MB para ${label}.`,
    });
  }
}

export class StorageQuotaExceededException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'STORAGE_QUOTA_EXCEEDED',
      message: 'Alcanzaste el límite de almacenamiento de tu plan.',
    });
  }
}

export class MediaStorageNotConfiguredException extends ServiceUnavailableException {
  constructor() {
    super({
      code: 'STORAGE_NOT_CONFIGURED',
      message:
        'Falta configurar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_STORAGE_BUCKET en el .env.',
    });
  }
}

export class MediaStorageUploadException extends BadRequestException {
  constructor() {
    super({
      code: 'MEDIA_UPLOAD_FAILED',
      message: 'No pudimos guardar el archivo. Intentá de nuevo.',
    });
  }
}
