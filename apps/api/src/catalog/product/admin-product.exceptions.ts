import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class CategoryNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'CATEGORY_NOT_FOUND',
      message: 'La categoría no existe en este restaurante.',
    });
  }
}

export class ProductNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'PRODUCT_NOT_FOUND',
      message: 'El producto no existe en este restaurante.',
    });
  }
}

export class MediaAssetNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'MEDIA_ASSET_NOT_FOUND',
      message: 'Uno de los archivos de imagen no existe en este restaurante.',
    });
  }
}

export class DuplicateSkuException extends ConflictException {
  constructor() {
    super({
      code: 'DUPLICATE_SKU',
      message: 'Ya existe un producto con ese SKU en este restaurante.',
    });
  }
}

export class ProductInUseException extends ConflictException {
  constructor() {
    super({
      code: 'PRODUCT_IN_USE',
      message: 'No se puede eliminar: el producto forma parte de un combo.',
    });
  }
}

export class PlanLimitExceededException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'PLAN_LIMIT_EXCEEDED',
      message: 'Alcanzaste el límite de productos de tu plan.',
    });
  }
}

export class ProductValidationException extends BadRequestException {
  constructor(field: string, issue: string) {
    super({
      code: 'VALIDATION_ERROR',
      message: 'El payload contiene campos inválidos.',
      details: [{ field, issue }],
    });
  }
}
