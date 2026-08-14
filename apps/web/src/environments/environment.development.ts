/**
 * Configuración de build de desarrollo (`ng serve` / `development` en
 * `angular.json`). `apps/api` corre en un puerto/origen distinto al de `ng
 * serve`, por eso acá `apiBaseUrl` es absoluto.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api/v1',
  /**
   * Impersonación temporal de PLATFORM_ADMIN en local (tenant seed `don-luigi`).
   * En Vercel (`environment.ts`) queda `null`: el selector de tenant todavía no
   * existe y el bundle de producción no debe impersonar un tenant de seed.
   */
  platformImpersonationTenantId: '00000000-0000-0000-0000-0000000000f2',
};
