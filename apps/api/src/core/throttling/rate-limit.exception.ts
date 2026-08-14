import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitExceededException extends HttpException {
  constructor(message: string) {
    super(
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export const LOGIN_RATE_LIMIT_MESSAGE =
  'Demasiados intentos de ingreso. Esperá un momento y volvé a probar.';

export const PUBLIC_RATE_LIMIT_MESSAGE =
  'Demasiadas solicitudes. Probá de nuevo en un momento.';
