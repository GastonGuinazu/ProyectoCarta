# Estados de cuenta y de sucursal

> Borrador de funcionamiento (podés reordenar / fusionar con `guia-tenants-duenos-y-slugs.md`).
> Contratos: `api-contracts.md` §5.10 y §5.11. Dominio: `domain-modules.md` §2.

Hay **dos estados independientes**. No se usan para lo mismo.

```text
Tenant.status              →  ¿la cuenta está habilitada en la plataforma?
Branch.operationalStatus   →  ¿este local está abierto hoy?
```

---

## 1. Cuenta (Tenant.status) — palanca de plataforma

Vive en `tenants.status`. Lo controlás **vos** (`PLATFORM_ADMIN`), no el dueño.

| Valor | Significado | Carta pública `/m/{tenant}/{branch}` | Login del dueño |
|---|---|---|---|
| `TRIAL` | Alta nueva, período de prueba. Default al crear. | Funciona | Funciona |
| `ACTIVE` | Cuenta operativa / restaurada. | Funciona | Funciona |
| `SUSPENDED` | Frenada (falta de pago, etc.). | No. `404 TENANT_SUSPENDED` → “Este local está temporalmente inactivo” | No. `403 TENANT_SUSPENDED` |
| `CANCELLED` | Baja. Mismo recorte que suspendido. | No | No |

`TRIAL` **no** es un error. Un restaurante recién creado funciona igual que uno `ACTIVE`.

### Dónde se cambia

Pantalla: `/admin/platform` (Gestión Global).

- **Suspender** (si está en `TRIAL` o `ACTIVE`) → manda `{ "status": "SUSPENDED" }`.
- **Reactivar** (si está en `SUSPENDED` o `CANCELLED`) → manda `{ "status": "ACTIVE" }`.

API: `PATCH /api/v1/admin/platform/tenants/:id/status`  
Body: `{ "status": "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED" }`  
Auth: JWT + rol **solo** `PLATFORM_ADMIN`. Sin `X-Tenant-Id`. Prisma crudo (consola cross-tenant).

`404 TENANT_NOT_FOUND` si el id no existe.

### Qué hace el backend al suspender

1. **Menú público** — `TenantResolutionGuard` mira el slug de la URL. Si el Tenant está `SUSPENDED` o `CANCELLED`, corta con `TENANT_SUSPENDED` **antes** de armar el catálogo. El QR y el enlace “no funcionan” (muestran menú no disponible, no un 500).
2. **Login / refresh del dueño** — `AuthService` bloquea si el Tenant del usuario está `SUSPENDED`/`CANCELLED`. `PLATFORM_ADMIN` no tiene Tenant, no lo afecta.
3. **Requests admin con JWT ya emitido** — `TenantContextGuard` vuelve a chequear el status. Un access token de ~15 min puede seguir un rato; el refresh ya no.

El dueño **no** puede revertir esto desde Configuración. Por eso es la palanca correcta si no paga.

### Alta

`POST /api/v1/admin/platform/tenants` siempre crea el Tenant en `TRIAL`. La sucursal nace `OPEN`.

---

## 2. Sucursal (Branch.operationalStatus) — palanca del dueño

Vive en `branches.operational_status`. Lo edita el **dueño / ADMIN** del restaurante.

| Valor | En la UI de Configuración | En la carta pública |
|---|---|---|
| `OPEN` | Abierta | Sin aviso extra |
| `CLOSED_TEMPORARILY` | Cerrada temporalmente | Banner ámbar: “Cerrado temporalmente…” |
| `MAINTENANCE` | En mantenimiento | Banner ámbar: “En mantenimiento…” |

La URL **sigue resolviendo**. El catálogo se sigue mostrando. Es un aviso (“hoy no atendemos”), no un corte de servicio.

### Dónde se cambia

Pantalla: `/admin/settings` (Configuración), radios “Estado de la sucursal”, se guarda con el resto del formulario.

API: `GET` / `PATCH /api/v1/admin/settings/branch`  
Campo: `operationalStatus`. Auth: JWT + rol `ADMIN` o superior (incluye `OWNER` y `PLATFORM_ADMIN` impersonando). El `tenantId` sale del JWT / `X-Tenant-Id`. El MVP usa la sucursal más antigua del Tenant.

No entra en el PATCH de branding por upload (logo/banner siguen por `POST`/`DELETE` de media).

### Qué hace el frontend público

`MenuLayoutComponent` lee `TenantStore.branch().operationalStatus` (viene en `GET /api/v1/menu/public/:tenantSlug/:branchSlug`). Si no es `OPEN`, pinta un aviso debajo del header. No cambia `resolutionStatus`; no es `notFound` ni `suspended`.

---

## 3. Qué usar en cada caso

| Situación | Palanca | Resultado |
|---|---|---|
| El cliente no pagó | Suspender cuenta en `/admin/platform` | URL muerta + dueño afuera |
| Pagó de nuevo / lo reactivás | Reactivar en `/admin/platform` | Cuenta `ACTIVE`, todo vuelve |
| Vacaciones, feriado, cierre de un local | Dueño: Configuración → Cerrada temporalmente | URL viva + aviso |
| Obras en el local | Dueño: Configuración → En mantenimiento | URL viva + aviso |

No uses “cerrada temporalmente” para un impago: el dueño la reabre solo.

No uses Suspender para “el local cierra los lunes”: cortás toda la marca y el panel.

---

## 4. Flujo resumido (carta pública)

```text
Comensal abre /m/{tenantSlug}/{branchSlug}
        │
        ▼
GET /api/v1/menu/public/:tenantSlug/:branchSlug
        │
        ▼
TenantResolutionGuard
  ├─ slug inexistente        → 404 TENANT_OR_BRANCH_NOT_FOUND
  ├─ Tenant SUSPENDED/CANCELLED → 404 TENANT_SUSPENDED   ← palanca plataforma
  └─ TRIAL o ACTIVE          → 200 + catálogo + branch.operationalStatus
                                      │
                                      ▼
                              Carta Angular
                                ├─ CLOSED / MAINTENANCE → aviso, menú igual
                                └─ OPEN                 → menú normal
```

Pantallas públicas:

- `resolutionStatus === 'suspended'` → “Este local está temporalmente inactivo”
- `resolutionStatus === 'notFound'` → “No encontramos este local”
- `resolved` + aviso de sucursal → header + banner ámbar + carta

---

## 5. Archivos (para quien toque código)

| Capa | Cuenta (Tenant) | Sucursal (Branch) |
|---|---|---|
| Prisma | `Tenant.status` / enum `TenantStatus` | `Branch.operationalStatus` / enum `BranchOperationalStatus` |
| API write | `admin-platform` `PATCH :id/status` | `admin-settings` `PATCH /branch` |
| API read | lista de `/admin/platform/tenants` | `GET /admin/settings/branch` y payload público de menú |
| Guard corte URL | `tenant-resolution.guard.ts` | no corta |
| Guard / login dueño | `auth.service.ts`, `tenant-context.guard.ts` | no bloquea |
| UI plataforma | `platform-tenants.component` | — |
| UI dueño | — | `settings.component` |
| UI comensal | `menu-layout` caso `'suspended'` | `menu-layout` `branchStatusNotice` |

---

## 6. Huecos / notas

- Reactivar desde la UI siempre manda `ACTIVE`, aunque el Tenant hubiera nacido en `TRIAL`.
- No hay job de facturación que suspenda solo: es acción manual en Gestión Global.
- `CANCELLED` se puede mandar por API; la UI de plataforma no tiene botón “Cancelar”, sí **Reactivar** si ya está cancelado.
- Con varias sucursales (todavía sin pantalla de alta de Branch), el PATCH de settings pega a la sucursal más antigua.
- Un JWT de dueño emitido **antes** de suspender puede vivir hasta ~15 min; el menú público se corta al toque.
- Impersonar (`X-Tenant-Id`) un Tenant ya `SUSPENDED` también lo rechaza `TenantContextGuard`. La consola `/admin/platform` no impersona: lista y cambia status sin TenantContext.
