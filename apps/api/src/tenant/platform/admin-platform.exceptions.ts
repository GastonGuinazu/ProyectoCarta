import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class TenantSlugTakenException extends ConflictException {
  constructor() {
    super({
      code: 'TENANT_SLUG_TAKEN',
      message: 'Ese slug de restaurante ya está en uso.',
    });
  }
}

export class OwnerEmailTakenException extends ConflictException {
  constructor() {
    super({
      code: 'OWNER_EMAIL_TAKEN',
      message: 'Ya existe un usuario con ese email.',
    });
  }
}

export class PlanNotConfiguredException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'PLAN_NOT_CONFIGURED',
      message:
        'No hay un plan de suscripción cargado. Sembrá los planes antes de dar de alta restaurantes.',
    });
  }
}

export class PlatformTenantNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'TENANT_NOT_FOUND',
      message: 'No encontramos ese restaurante.',
    });
  }
}

export class PlatformOwnerNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'OWNER_NOT_FOUND',
      message: 'Ese restaurante no tiene un usuario dueño.',
    });
  }
}
