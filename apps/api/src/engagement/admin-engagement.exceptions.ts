import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

export class PromoNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'PROMO_NOT_FOUND',
      message: 'La promoción no existe en este restaurante.',
    });
  }
}

export class HappyHourNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'HAPPY_HOUR_NOT_FOUND',
      message: 'El Happy Hour no existe en este restaurante.',
    });
  }
}

export class OfferTargetNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'OFFER_TARGET_NOT_FOUND',
      message: 'Uno o más platos, categorías o combos no existen en este restaurante.',
    });
  }
}

export class OfferValidationException extends BadRequestException {
  constructor(field: string, issue: string) {
    super({
      code: 'VALIDATION_ERROR',
      message: 'El payload contiene campos inválidos.',
      details: [{ field, issue }],
    });
  }
}
