import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/**
 * Multer corta la request antes del Service. Sin este filtro, un .glb pesado
 * termina en un 500 vacío y el frontend lo muestra como "no hay conexión".
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception.code === 'LIMIT_FILE_SIZE') {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        code: 'MEDIA_FILE_TOO_LARGE',
        message: 'El archivo supera el máximo de 50 MB.',
      });
      return;
    }

    response.status(HttpStatus.BAD_REQUEST).json({
      code: 'MEDIA_UPLOAD_FAILED',
      message: 'No pudimos leer el archivo. Intentá de nuevo.',
    });
  }
}
