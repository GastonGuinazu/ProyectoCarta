import {
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

export function IsLocalizedText(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isLocalizedText',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
          }
          const entries = Object.entries(value as Record<string, unknown>);
          if (entries.length === 0) {
            return false;
          }
          return entries.every(
            ([key, text]) =>
              key.trim().length > 0 &&
              typeof text === 'string' &&
              text.trim().length > 0,
          );
        },
        defaultMessage(): string {
          return 'Debe ser un objeto de traducciones { "es": "..." } con al menos un idioma.';
        },
      },
    });
  };
}
