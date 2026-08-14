/**
 * Configuración de build de producción. Se reemplaza por `environment.development.ts`
 * en la configuración `development` de `angular.json` (`fileReplacements`).
 *
 * `apiBaseUrl` en Vercel sale de `API_PUBLIC_URL` (origen `https://api.<dominio>/api/v1`).
 * No hay proxy `/api` en Vercel: el body serverless es ~4.5 MB y las subidas van
 * a 10–50 MB (docs/hosting.md).
 */
import { productionApiBaseUrl } from './api-base.generated';

export const environment = {
  production: true,
  apiBaseUrl: productionApiBaseUrl,
  /** Confirmado: el bundle de Vercel no impersona un tenant de seed. */
  platformImpersonationTenantId: null as string | null,
};
