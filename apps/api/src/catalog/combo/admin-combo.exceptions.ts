import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

export class ComboNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'COMBO_NOT_FOUND',
      message: 'El combo no existe en este restaurante.',
    });
  }
}

export class ComboProductNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Uno o más productos del combo no existen en este restaurante.',
    });
  }
}

export class ComboValidationException extends BadRequestException {
  constructor(field: string, issue: string) {
    super({
      code: 'VALIDATION_ERROR',
      message: 'El payload contiene campos inválidos.',
      details: [{ field, issue }],
    });
  }
}
