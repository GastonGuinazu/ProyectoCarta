# Camino a producción

Checklist para el primer piloto. Tildar en el repo (y en el canvas del chat).

**Hosting acordado:** front Angular en **Vercel**; API NestJS en **Railway** (proceso largo; `Dockerfile` portable a Render/Fly); Postgres + Storage en **Supabase**. Nest **no** va a Vercel Functions ni se proxea `/api` por Vercel: las subidas de foto (10 MB) y modelos 3D (50 MB) superan el body de ~4.5 MB. Detalle: `docs/hosting.md`.

**Atajos ya tomados** (qué hay hoy vs. qué hay que cambiar después): `docs/produccion-deuda.md`. No es este checklist: es la lista viva de recortes.

---

## 1. Hosting (cerrar esto primero)

- [x] Front Angular en Vercel (SPA estática). `apps/web/vercel.json`; Root Directory `apps/web`; output `dist/web/browser`.
- [x] API NestJS en Railway (no Vercel Functions). `Dockerfile` + `railway.toml`; Nest escucha `0.0.0.0:$PORT`.
- [x] Postgres + Storage siguen en Supabase.
- [x] Dominio propio: web `proyectocarta.com` y API `api.proyectocarta.com` (cookies HTTPS host-only en `api.`). Descartado: proxy `/api` por Vercel.

## 2. Config que hoy rompe producción

- [x] CORS desde variable de entorno (allowlist del front), no `http://localhost:4200` hardcodeado.
- [x] `AUTH_COOKIE_SECURE=true` y SameSite correcto en HTTPS.
- [x] `JWT_SECRET` y `AUTH_PEPPER` largos, distintos, solo en el host de la API.
- [x] No publicar el seed `admin@…` / `admin123`. Crear el `PLATFORM_ADMIN` de prod a mano.
- [x] `environment.ts` de prod: `platformImpersonationTenantId = null` (ya está).
- [x] `GET /api/v1/health` para el host de la API.

## 3. Seguridad mínima

- [x] Rate limit agresivo en `POST /admin/auth/login`.
- [x] Rate limit en el GET del menú público y en POST de analytics.
- [x] Headers de seguridad (Helmet) en la API.

## 4. Que el dueño no te llame

- [x] Cambiar contraseña estando logueado.
- [x] Recuperar contraseña por email, o reset manual desde Gestión Global.

## 5. Primer deploy

- [x] Proyecto Vercel: root `apps/web`, `ng build`, output `dist/web/browser`.
- [x] Deploy Nest + env (`DATABASE_URL`, JWT, pepper, CORS, Supabase).
- [x] `prisma migrate deploy` contra prod (`DIRECT_URL`, no el pooler 6543).
- [x] Bucket `menu-assets` con lectura pública; `service_role` solo en Nest.
- [x] Smoke: alta de un restaurante de prueba, login, carta, upload de foto, QR, suspender.

## 6. Después del piloto (no bloquea el primer local)

- [ ] Invitar staff / admin desde el panel del dueño.
- [ ] Variantes (tamaño, extras) en el formulario de producto.
- [ ] CI: lint + build en cada PR.
- [ ] Backups de Postgres verificados con un restore de prueba.
- [ ] Disclaimer de alérgenos + términos / privacidad.
