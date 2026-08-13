/**
 * Configuración de build de desarrollo (`ng serve` / `development` en
 * `angular.json`). `apps/api` corre en un puerto/origen distinto al de `ng
 * serve`, por eso acá `apiBaseUrl` es absoluto.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api/v1',
};
