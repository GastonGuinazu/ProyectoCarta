import {
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import { isUuidLike } from './uuid-like';

export function IsUuidLike(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isUuidLike',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (Array.isArray(value)) {
            return value.every(
              (item) => typeof item === 'string' && isUuidLike(item),
            );
          }
          return typeof value === 'string' && isUuidLike(value);
        },
        defaultMessage(): string {
          return 'Debe ser un UUID (8-4-4-4-12).';
        },
      },
    });
  };
}
