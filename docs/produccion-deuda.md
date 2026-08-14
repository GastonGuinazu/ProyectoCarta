# Deuda del piloto — qué hay que modificar después

Lista viva de **atajos ya tomados** (código o config) que más adelante hay que cambiar. No duplica la fase 6 de `produccion-checklist.md` (eso es trabajo planificado, todavía no hecho). Las fases 1–5 (hosting, config, seguridad, claves del dueño, primer deploy) ya están en el repo.

**Cómo usarla:** si implementás un recorte respecto de `architecture.md` / `features-spec.md` / `hosting.md`, agregá una fila acá (hoy → después → archivos). Si el cambio se hace, borrala.

---

## Hosting y origen

| Hoy | Después | Dónde tocar |
|---|---|---|
| Front en Vercel llama a `https://api.proyectocarta.com` (origen partido). Un rewrite `/api` por Vercel está **descartado** (body ~4.5 MB). | Si se quiere un solo origen (`proyectocarta.com/api/…`), el proxy tiene que ser un **proceso largo** (Caddy/nginx/Railway), nunca Vercel Functions. | `docs/hosting.md`, `apps/web/vercel.json`, `API_PUBLIC_URL`, cookie `Path`/`SameSite` |
| `apps/web/vercel.json` excluye `/api/` del fallback SPA (defensa por si alguien pega mal al mismo origen). | Si el proxy de proceso largo existe, reescribir esa regla; no convertirla en proxy de Vercel. | `apps/web/vercel.json` |
| `GET /api/v1` sigue devolviendo `Hello World!`. El host usa `GET /api/v1/health`. | Quitar el hello o devolver el mismo liveness. | `apps/api/src/app.controller.ts` |
| Healthcheck es **liveness** (`{ status: "ok" }`, sin Postgres ni Storage). | Readiness aparte si Railway debe sacar de rotación cuando falle Supabase. | `apps/api/src/app.service.ts`, `railway.toml` |

## CORS, cookies, secretos

| Hoy | Después | Dónde tocar |
|---|---|---|
| CORS = allowlist estática `PUBLIC_WEB_ORIGIN` (Vercel: `https://proyectocarta.com` + `www`). | CORS **dinámico por Tenant** (subdominio / dominio custom verificado por DNS), `features-spec.md` §7.6. No usar `*.vercel.app`. | `apps/api/src/core/config/env.validation.ts`, `apps/api/src/main.ts`, tabla de dominios del Tenant |
| Previews de Vercel (`*.vercel.app`) **no** están en la allowlist. | Si hace falta probar un preview contra la API de prod, agregar el origen **exacto** a `PUBLIC_WEB_ORIGIN` en Railway y sacarlo después. Nunca un wildcard. | Dashboard Railway, `.env` de la API |
| Cookie de refresh: host-only en `api.proyectocarta.com`, `SameSite=Strict`, `Secure`. Funciona porque web y API comparten eTLD+1. | Si el panel se sirve desde **otro registrable** (dominio custom del restaurante), Strict deja de mandar la cookie: hay que rediseñar SameSite / origen, no poner `Domain=.proyectocarta.com` a ciegas. | `apps/api/src/auth/auth.controller.ts`, `docs/hosting.md` |
| Validación estricta de `JWT_SECRET` / `AUTH_PEPPER` / `AUTH_COOKIE_SECURE` solo con `NODE_ENV=production`. Local admite los placeholders de `.env.example`. | Cuando haya CI (fase 6), un job de prod-like debe arrancar Nest con env de producción de mentira y esperar que falle si los secretos son débiles. | `apps/api/src/core/config/env.validation.ts` |

## Auth y operadores

| Hoy | Después | Dónde tocar |
|---|---|---|
| `PLATFORM_ADMIN` de prod se crea **a mano** (`docs/hosting.md`). `seed-admin.ts` aborta si `NODE_ENV=production`. | No reintroducir `admin123`. Si hay onboarding de operadores, que no sea el seed publicado. | `prisma/seed-admin.ts` |
| `environment.ts` de Vercel: `platformImpersonationTenantId = null`. En local está hardcodeado al tenant seed. | Selector de tenant en el panel para `PLATFORM_ADMIN` (el impersonar con `X-Tenant-Id` ya existe en API). | `apps/web/src/environments/environment*.ts`, `auth.store.ts`, layout admin |
| Invitar `ADMIN`/`STAFF` desde el panel del dueño: no existe. El alta de plataforma solo crea el `OWNER`. | Fase 6 del checklist + `guia-tenants-duenos-y-slugs.md` §11. | módulo Tenant / usuarios |
| Reset del dueño es **manual** desde Gestión Global. No hay email de recovery. | AuthModule fase 2 (`architecture.md` §2.3): forgot/reset por email. | `AuthModule`, SMTP en Railway (nunca en Vercel) |
| Un `User` = un `tenantId`; el mismo email no puede ser dueño de dos marcas. | Unificar login multi-tenant es decisión de producto: documentar en `domain-modules.md` **antes** de codear. | `guia-tenants-duenos-y-slugs.md` §9 |
| `BranchScopeGuard` no está implementado (STAFF vs sucursal). | Ticket de RBAC: `RolesGuard` ya deja pasar; el alcance por sucursal falta. | `apps/api/src/auth/guards/roles.guard.ts`, `backend-architecture.md` §3.2 |

## Contrato y front (atajos que el piloto ya convive)

| Hoy | Después | Dónde tocar |
|---|---|---|
| Errores de la API van `{ code, message }` plano. El front acepta también `{ error: { … } }`. | `ExceptionFilter` global según `api-contracts.md` §2.1. | `apps/api` (filter nuevo), `apps/web/src/app/utils/api-error.utils.ts` |
| El menú público no manda `meta.menuVersion` / ETag. El front deja `menuVersion: null`. | Definir invalidación de caché (`frontend-architecture.md` §3.3) y el campo en el payload. | `PublicMenuModule`, `tenant-resolver.service.ts` |
| Borrar categoría con hijos: `409 CATEGORY_IN_USE`. No hay cascada/reasignar. | Flujo de `features-spec.md` §2.4. | admin categorías |
| Throttle in-memory (un proceso Railway). | Storage compartido (Redis) si hay réplicas. | `AppThrottlerGuard`, `@nestjs/throttler` |
| Login: tope por IP; no hay lockout progresivo por cuenta. | Contar fallos y bloquear el `User` (`api-contracts.md` §4.2). | `auth.service` |
| Admin autenticado sin throttle (salvo login). | Tope por plan cuando ya hay `TenantContext`. | `AppThrottlerGuard`, `backend-architecture.md` §3.2 |
| Analytics: hay dedup de sesión + throttle por IP/plan. No hay tope extra por `sessionId`. | Límite de eventos por sesión anónima (`features-spec.md` §7.5). | `AnalyticsService` |

## No tocar (decisiones cerradas)

Estos **no** son deuda: son vetos. Si un ticket pide lo contrario, señalar `docs/hosting.md`.

- Nest **no** va a Vercel Functions.
- Vercel **no** proxea `/api` hacia Railway.
- `service_role` de Supabase **solo** en Nest.
- `JWT_SECRET` / `AUTH_PEPPER` **solo** en el host de la API.
