import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

export class AdminCategoryNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'CATEGORY_NOT_FOUND',
      message: 'La categoría no existe en este restaurante.',
    });
  }
}

export class CategoryInUseException extends ConflictException {
  constructor() {
    super({
      code: 'CATEGORY_IN_USE',
      message:
        'No se puede eliminar: la categoría tiene productos o subcategorías. Reasignalos o vaciala antes.',
    });
  }
}

export class CategoryReorderMismatchException extends ConflictException {
  constructor() {
    super({
      code: 'CATEGORY_REORDER_MISMATCH',
      message:
        'El listado de categorías no coincide con el catálogo actual. Recargá e intentá de nuevo.',
    });
  }
}

export class CategoryValidationException extends BadRequestException {
  constructor(field: string, issue: string) {
    super({
      code: 'VALIDATION_ERROR',
      message: 'El payload contiene campos inválidos.',
      details: [{ field, issue }],
    });
  }
}
