/**
 * Configuración de build de desarrollo (`ng serve` / `development` en
 * `angular.json`). `apps/api` corre en un puerto/origen distinto al de `ng
 * serve`, por eso acá `apiBaseUrl` es absoluto. En la LAN (teléfono) usa el
 * mismo hostname que la página, no `localhost` del celular.
 */
import { resolveDevApiBaseUrl } from './dev-api-base';

export const environment = {
  production: false,
  apiBaseUrl: resolveDevApiBaseUrl(),
  /**
   * Impersonación de PLATFORM_ADMIN. `null` = Gestión Global sin tenant
   * (igual que Vercel). El seed `don-luigi` ya no está; un id fijo 404-eaba
   * el listado. Para cargar el catálogo, entrar como dueño del restaurante.
   */
  platformImpersonationTenantId: null as string | null,
};
