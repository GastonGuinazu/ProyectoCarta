# Hosting de producción

Decisión cerrada para el piloto. El checklist operativo está en `produccion-checklist.md`. Atajos a revertir (CORS estático, cookie eTLD+1, health sin DB, etc.): `produccion-deuda.md`.

## Topología

| Superficie | Dónde | Qué corre |
|---|---|---|
| Carta + Panel Admin (Angular 19) | **Vercel** | SPA estática (`ng build` → `dist/web/browser`) |
| API NestJS | **Railway** (proceso Node largo) | `apps/api` vía `Dockerfile` en la raíz del repo |
| Postgres + Storage | **Supabase** | Sin cambio: Prisma contra Postgres; bucket `menu-assets` |

```
Comensal / dueño
        │
        ▼
https://proyectocarta.com          Vercel (solo estáticos + rewrite SPA)
        │
        │  fetch https://api.proyectocarta.com/api/v1/...
        │  (cookies de refresh: host-only en api.*)
        ▼
https://api.proyectocarta.com      Railway → NestJS
        │
        ├── Postgres (Supabase)
        └── Storage (Supabase)
```

Mismo registrable (`proyectocarta.com` y `api.proyectocarta.com`): las cookies `SameSite=Strict` del refresh **sí** viajan en `fetch` con `credentials` porque son same-site (eTLD+1), aunque el origen sea distinto. CORS con credenciales usa la allowlist `PUBLIC_WEB_ORIGIN` (origen del front en Vercel; coma-separada). Dominios custom por tenant quedan para `features-spec.md` §7.6, no este piloto.

## Qué está prohibido (y por qué)

**Nest no va a Vercel Functions.** Las subidas de foto llegan a 10 MB y los modelos `.glb` a 50 MB (`MEDIA_IMAGE_MAX_BYTES` / `MEDIA_MODEL_MAX_BYTES`). El body de Vercel Serverless/Edge es ~4.5 MB: el upload moriría en el edge, nunca en Nest.

**Vercel no hace de reverse-proxy de `/api`.** Un rewrite `/api/:path*` → `https://api…` sigue atravesando el límite de body de Vercel. El front llama a `API_PUBLIC_URL` (origen `api.`) en el build de producción. El `apiBaseUrl: '/api/v1'` relativo queda solo como fallback de `ng build` local sin esa variable.

**No se usa un único dominio con proxy `/api` por Vercel.** Esa alternativa del checklist queda descartada. Si más adelante se quiere un solo origen, el proxy tiene que ser un proceso largo (Caddy/nginx/Railway), no Vercel.

Railway, Render y Fly sirven como host de Nest. El artefacto portable es el `Dockerfile` de la raíz; **Railway es el host elegido** para el piloto (región **São Paulo** para quedar cerca del pooler de Supabase `sa-east-1`).

## Front — Vercel

1. Nuevo proyecto Vercel con **Root Directory** `apps/web` (no la raíz del monorepo) y **Include source files outside of the Root Directory** activado, para que `npm ci` use el lockfile de la raíz. `apps/web/vercel.json` instala desde el workspace y publica `dist/web/browser`.
2. Si el proyecto se conecta por error a la raíz del repo, `vercel.json` de la raíz **solo** construye el SPA (`framework: null`, output `apps/web/dist/web/browser`). Nest no se publica: `.vercelignore` deja fuera `apps/api/**` (salvo `package.json` del workspace).
3. Build: `npm run build` (`prebuild` escribe `src/environments/api-base.generated.ts`).
4. Output: `dist/web/browser` relativo a `apps/web`.
5. Variable de entorno de **build**: `API_PUBLIC_URL=https://api.proyectocarta.com/api/v1`. Sin ella el build en Vercel falla a propósito, para no publicar un front que pega a `/api` en el mismo origen.
6. Dominio: `proyectocarta.com` (y `www` → apex si aplica).
7. No crear Functions ni rewrites hacia la API. No crear un segundo proyecto Vercel sobre `apps/api`.

Rewrites: solo fallback SPA a `index.html` para rutas Angular (`/m/…`, `/admin/…`). Los estáticos existentes se sirven primero.

## API — Railway

1. Nuevo servicio desde este repo, builder Docker (`railway.toml` + `Dockerfile`).
2. Bind: Nest escucha `0.0.0.0:$PORT` (Railway inyecta `PORT`).
3. Healthcheck HTTP: `GET /api/v1/health` (`{ "status": "ok" }`, sin JWT ni DB).
4. Dominio custom: `api.proyectocarta.com`.
5. Variables (valores reales en el dashboard, no en git): las de `.env.example` (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `AUTH_PEPPER`, `PUBLIC_WEB_ORIGIN`, `AUTH_COOKIE_SECURE=true`, `SUPABASE_*`, `AUTH_LOGIN_RATE_LIMIT`, etc.). `JWT_SECRET` y `AUTH_PEPPER` solo viven acá, nunca en Vercel. Nest rechaza el arranque en producción si los secretos son cortos/placeholder, si son iguales, si CORS no es https, si `AUTH_COOKIE_SECURE` no es `true`, o si `DIRECT_URL` falta o usa el pooler 6543.
6. Seguridad en este proceso (no en Vercel Functions): Helmet (CORP `cross-origin` porque el front está en otro origen) y `ThrottlerGuard` — login agresivo por IP; GET del menú y POST de analytics según `Plan.rateLimitPerMinute`.
7. `prisma migrate deploy` corre en el arranque de la imagen (`scripts/api-entrypoint.mjs`) contra `DIRECT_URL` (puerto 5432, no el pooler 6543). El healthcheck de Railway espera 120s para dar tiempo a la migración.

El mismo `Dockerfile` sirve para Render o Fly si Railway deja de ser opción.

## Cookies HTTPS en origen partido

La cookie de refresh se setea en `api.proyectocarta.com` **sin** atributo `Domain` (host-only), `Path=/api/v1/admin/auth`, `HttpOnly`, `Secure` (`AUTH_COOKIE_SECURE=true` en Railway), `SameSite=Strict`. El Panel Admin ya manda `withCredentials: true` en `/api/v1/admin/**`.

No hace falta `Domain=.proyectocarta.com`: el browser guarda la cookie para el host de la API y la reenvía en refresh/logout. Ampliar `Domain` expondría la cookie a cualquier subdominio futuro.

## PLATFORM_ADMIN de producción

`prisma/seed-admin.ts` es solo local: pide `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` (mín. 12, no `admin123`) y **aborta** si `NODE_ENV=production`. No está en el `CMD` de Docker ni se publica una clave por defecto.

El primer operador de prod se crea **a mano** desde tu máquina, contra `DIRECT_URL` de prod, **sin** `NODE_ENV=production`:

```bash
PLATFORM_ADMIN_EMAIL="operador@tu-dominio" \
PLATFORM_ADMIN_PASSWORD="…" \
DATABASE_URL="postgresql://…:5432/postgres" \
DIRECT_URL="postgresql://…:5432/postgres" \
npx tsx prisma/seed-admin.ts
```

No dejes esas variables en el dashboard de Railway.

## Supabase

Sin cambio de hosting: Postgres y Storage siguen ahí. La `service_role` solo vive en Nest (Railway), nunca en Vercel ni en el bundle de Angular.

El bucket `menu-assets` se crea o se pone en lectura pública en el primer upload (`SupabaseStorageService`) y se puede adelantar con `npm run storage:ensure-bucket` contra las mismas variables de Railway. Escritura: solo `service_role`. Lectura: URL pública `/object/public/menu-assets/…`.

## Primer deploy

Checklist operativo (fase 5). Secretos solo en los dashboards, nunca en git.

1. **Supabase.** Postgres en `sa-east-1`. Copiá `DATABASE_URL` (pooler, puede ser 6543 con `pgbouncer=true`) y `DIRECT_URL` (5432). Storage: no hace falta crear el bucket a mano si vas a correr el ensure o un upload; la `service_role` no va a Vercel.
2. **Railway.** Nuevo servicio desde este repo, builder Docker, región São Paulo. Variables: las de `.env.example` de prod (`PUBLIC_WEB_ORIGIN=https://proyectocarta.com,https://www.proyectocarta.com`, `AUTH_COOKIE_SECURE=true`, JWT y pepper distintos ≥32, `SUPABASE_*`). Dominio `api.proyectocarta.com`. El `CMD` corre `prisma migrate deploy` y después Nest. Health: `GET https://api.proyectocarta.com/api/v1/health`.
3. **PLATFORM_ADMIN.** Desde tu máquina, **sin** `NODE_ENV=production`, contra `DIRECT_URL` de prod: el comando de `seed-admin.ts` más arriba. No dejes email/clave en Railway.
4. **Vercel.** Root Directory `apps/web` + include files outside root. Env de **build**: `API_PUBLIC_URL=https://api.proyectocarta.com/api/v1`. Dominio `proyectocarta.com`. Confirmá que el proyecto no tiene Functions.
5. **Smoke.** Con el operador de prod:

```bash
API_PUBLIC_URL="https://api.proyectocarta.com/api/v1" \
PUBLIC_WEB_ORIGIN="https://proyectocarta.com" \
SMOKE_ADMIN_EMAIL="operador@tu-dominio" \
SMOKE_ADMIN_PASSWORD="…" \
npm run smoke:prod
```

Alta un restaurante `piloto-smoke-…`, login, categoría, producto, foto, carta pública, URL del QR (`/m/{slug}/{sucursal}`) y suspende (después lo reactiva para que puedas mirarlo). No uses el seed demo `Don Luigi` en prod.

