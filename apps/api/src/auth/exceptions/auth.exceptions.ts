import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({
      code: 'INVALID_CREDENTIALS',
      message: 'Email o contraseña incorrectos.',
    });
  }
}

export class AccountDisabledException extends ForbiddenException {
  constructor() {
    super({
      code: 'ACCOUNT_DISABLED',
      message: 'Esta cuenta no está activa.',
    });
  }
}

/** 403 en login (api-contracts.md §4.6). Distinto del 404 del menú público. */
export class AuthTenantSuspendedException extends ForbiddenException {
  constructor() {
    super({
      code: 'TENANT_SUSPENDED',
      message: 'Este local está temporalmente inactivo.',
    });
  }
}

/** Cookie ausente, expirada, revocada o reuse de un refresh ya rotado. */
export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super({
      code: 'INVALID_REFRESH_TOKEN',
      message: 'La sesión expiró. Volvé a ingresar.',
    });
  }
}

/** JWT válido; la clave actual no coincide. No es 401: el interceptor del panel cerraría la sesión. */
export class CurrentPasswordInvalidException extends BadRequestException {
  constructor() {
    super({
      code: 'CURRENT_PASSWORD_INVALID',
      message: 'La contraseña actual no es correcta.',
    });
  }
}

export class NewPasswordMustDifferException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'NEW_PASSWORD_MUST_DIFFER',
      message: 'La contraseña nueva tiene que ser distinta de la actual.',
    });
  }
}
