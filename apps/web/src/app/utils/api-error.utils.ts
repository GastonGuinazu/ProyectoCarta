/**
 * Funciones puras para interpretar el cuerpo de error de la API
 * (docs/frontend-architecture.md §4.1 — capa `utils/`). No dependen de Angular
 * ni de `HttpClient` directamente: reciben el `error` ya desempaquetado de un
 * `HttpErrorResponse`.
 *
 * Soporta DOS formas posibles a propósito:
 * 1. La forma REAL que devuelve hoy el backend (`{ code, message }` plano),
 *    porque `apps/api` todavía no tiene un `ExceptionFilter` global que envuelva
 *    los errores según el contrato.
 * 2. La forma documentada en docs/api-contracts.md §3.7 (`{ error: { code,
 *    message, ... } }`), para que el día que ese filtro exista, este código no
 *    necesite cambios.
 */

interface FlatApiErrorBody {
  readonly code?: unknown;
}

interface WrappedApiErrorBody {
  readonly error?: FlatApiErrorBody;
}

type ApiErrorBody = FlatApiErrorBody & WrappedApiErrorBody;

/** Extrae el código de negocio del error (ej. `TENANT_OR_BRANCH_NOT_FOUND`), si existe. */
export function extractApiErrorCode(errorBody: unknown): string | undefined {
  if (!errorBody || typeof errorBody !== 'object') {
    return undefined;
  }

  const body = errorBody as ApiErrorBody;
  const wrappedCode = body.error?.code;
  const flatCode = body.code;
  const code = wrappedCode ?? flatCode;

  return typeof code === 'string' ? code : undefined;
}

interface FlatApiErrorMessageBody {
  readonly message?: unknown;
}

interface WrappedApiErrorMessageBody {
  readonly error?: FlatApiErrorMessageBody;
}

/** Extrae el mensaje de negocio del error, si existe. */
export function extractApiErrorMessage(errorBody: unknown): string | undefined {
  if (!errorBody || typeof errorBody !== 'object') {
    return undefined;
  }

  const body = errorBody as FlatApiErrorMessageBody & WrappedApiErrorMessageBody;
  const wrappedMessage = body.error?.message;
  const flatMessage = body.message;
  const message = wrappedMessage ?? flatMessage;

  return typeof message === 'string' && message.trim().length > 0
    ? message
    : undefined;
}
