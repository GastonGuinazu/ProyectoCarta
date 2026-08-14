import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { isUuidLike } from '../validation/uuid-like';

@Injectable()
export class ParseUuidLikePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isUuidLike(value)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'El identificador no es un UUID válido.',
      });
    }
    return value;
  }
}
