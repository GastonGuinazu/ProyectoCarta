/**
 * En `ng serve`, el teléfono abre `http://192.168.x.x:4200`. Si `apiBaseUrl`
 * apunta a `localhost:3000`, esa localhost es el celular, no la PC.
 * Mismo hostname, puerto de Nest.
 */
export function resolveDevApiBaseUrl(): string {
  const fallback = 'http://localhost:3000/api/v1';
  if (typeof window === 'undefined') {
    return fallback;
  }
  const { hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return fallback;
  }
  return `${protocol}//${hostname}:3000/api/v1`;
}
