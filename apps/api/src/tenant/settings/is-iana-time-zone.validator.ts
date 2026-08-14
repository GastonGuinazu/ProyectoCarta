import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isIanaTimeZone', async: false })
export class IsIanaTimeZoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return false;
    }
    try {
      Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'La zona horaria debe ser un identificador IANA válido.';
  }
}

export function IsIanaTimeZone(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsIanaTimeZoneConstraint,
    });
  };
}
