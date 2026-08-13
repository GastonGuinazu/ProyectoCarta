/**
 * Configuración de build de producción. Se reemplaza por `environment.development.ts`
 * en la configuración `development` de `angular.json` (`fileReplacements`).
 *
 * `apiBaseUrl` relativo asume que en producción el frontend y `apps/api` se
 * sirven bajo el mismo origen (ej. proxy/reverse-proxy compartido) — si eso
 * cambia, este valor debe seguir viniendo de config de build, nunca hardcodeado
 * dentro de un servicio.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
};
