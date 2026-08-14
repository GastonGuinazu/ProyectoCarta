import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { provideAuthSessionRestore } from './core/auth/auth-session.initializer';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // withComponentInputBinding(): permite bindear parámetros/data de ruta
    // directamente como `input()` de componente en cualquier feature, sin
    // plomería manual por ruta (hoy no hay ningún componente que lo use tras
    // migrar `menu-public` a `features/`, se mantiene para futuras rutas).
    provideRouter(routes, withComponentInputBinding()),
    // HttpClient nativo (standalone), sin HttpClientModule
    // (docs/frontend-architecture.md §4.2 — RxJS reservado a llamadas HTTP).
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAuthSessionRestore(),
    // Base de la estrategia offline-first Stale-While-Revalidate
    // (docs/architecture.md §4.2, docs/frontend-architecture.md §3). El registro
    // se demora hasta que la app está "stable" para no competir con el primer
    // render por recursos de red/CPU (docs/frontend-architecture.md §3.4 —
    // "la UI nunca espera a la red").
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
