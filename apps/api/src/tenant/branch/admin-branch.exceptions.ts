import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class BranchSlugTakenException extends ConflictException {
  constructor() {
    super({
      code: 'BRANCH_SLUG_TAKEN',
      message: 'Ese slug de sucursal ya está en uso en este restaurante.',
    });
  }
}

export class BranchLimitReachedException extends UnprocessableEntityException {
  constructor(maxBranches: number) {
    super({
      code: 'BRANCH_LIMIT_REACHED',
      message: `Alcanzaste el límite de ${maxBranches} sucursales de tu plan.`,
    });
  }
}

export class AdminBranchNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'BRANCH_NOT_FOUND',
      message: 'Esa sucursal no existe en este restaurante.',
    });
  }
}

export class SourceBranchNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'SOURCE_BRANCH_NOT_FOUND',
      message: 'La sucursal de origen del menú no existe en este restaurante.',
    });
  }
}

export class BranchPatchEmptyException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'BRANCH_PATCH_EMPTY',
      message: 'Indicá al menos un campo para actualizar (nombre o slug).',
    });
  }
}
