# Guía operativa: restaurantes, dueños, sucursales y slugs

> **Para quién**: operadores de plataforma (`PLATFORM_ADMIN`) y quien configure el alta de clientes.
> **Fuente de verdad de dominio**: `domain-modules.md` §2, `architecture.md` §3, `api-contracts.md` §5.11.
> **Estados de cuenta vs. sucursal** (suspender por impago, cerrado/mantenimiento): `estados-cuenta-y-sucursal.md`.
> **Estado de implementación**: describe lo que el sistema hace **hoy** y lo que el dominio ya contempla pero todavía no tiene pantalla/API.

---

## 1. Vocabulario (no son sinónimos)

| En la UI / el día a día | En el sistema | Qué es |
|---|---|---|
| Restaurante / marca / cliente | **Tenant** | La cuenta contratante. Puede ser un local único o una cadena. Tiene plan, facturación y branding (logo, color). |
| Local / punto de venta | **Branch (Sucursal)** | Un lugar físico de ese Tenant. Cada sucursal tiene su propia carta pública (URL + QR). |
| Dueño | **User + rol `OWNER`** | Persona que entra al panel admin. Pertenece a **un** Tenant. |
| Nosotros (ProyectoCarta) | **`PLATFORM_ADMIN`** | Operador de la plataforma. No es dueño de ningún restaurante. |

Jerarquía obligatoria: **Tenant → Sucursal → Menú → QR**.

Un Tenant **no es** “un usuario”. Un Tenant es la organización. El dueño es un usuario de esa organización.

---

## 2. Qué significa el estado `TRIAL`

Al crear un restaurante desde `/admin/platform` el Tenant nace con `status: TRIAL`. Es el valor por defecto del esquema (`TenantStatus`) y lo setea el alta de plataforma a propósito.

| Estado | Significado | ¿El dueño entra al admin? | ¿El comensal ve el menú? |
|---|---|---|---|
| **`TRIAL`** | Período de prueba. Cuenta dada de alta, todavía no hay un flujo de cobro que la pase a “contratada”. | Sí | Sí |
| **`ACTIVE`** | Cuenta operativa / contratada (el seed de ejemplo usa este estado). | Sí | Sí |
| **`SUSPENDED`** | Cuenta frenada (ej. falta de pago). | No (`TENANT_SUSPENDED`) | No (página de menú no disponible) |
| **`CANCELLED`** | Baja. Mismo recorte que suspendido. | No | No |

**`TRIAL` no es un error.** El restaurante funciona: el dueño puede cargar catálogo, branding y QR; el menú público `/m/{slug-restaurante}/{slug-sucursal}` resuelve igual que uno `ACTIVE`. El guard público solo corta `SUSPENDED` y `CANCELLED`.

Desde `/admin/platform` (solo `PLATFORM_ADMIN`): **Suspender** pasa la cuenta a `SUSPENDED` (falta de pago); **Reactivar** la deja en `ACTIVE`. No hace falta pasar por `ACTIVE` para que un `TRIAL` funcione.

No confundir con el **estado operativo de la sucursal** (abierta / cerrada / mantenimiento): eso lo edita el dueño en `/admin/settings` y **no corta** el enlace.

No confundir con el estado del **usuario** dueño: ese queda `ACTIVE` (puede iniciar sesión mientras el Tenant no esté suspendido). `TRIAL` es solo del Tenant.

---

## 3. Qué se crea en un alta (“Nuevo restaurante”)

Un `POST /api/v1/admin/platform/tenants` (solo `PLATFORM_ADMIN`) crea **en una transacción**:

1. **Tenant** — nombre comercial + slug del restaurante, plan más antiguo de la tabla `plans`, estado `TRIAL`.
2. **Branch** — sucursal inicial. Si no se indica nombre → `Casa Matriz`. Slug de sucursal obligatorio.
3. **User `OWNER`** — email + contraseña (hash Argon2id **fuera** de la transacción). `tenantId` = ese Tenant.
4. **RoleAssignment** — rol `OWNER`, alcance **TENANT** (`branchId` nulo): el dueño administra **todas** las sucursales de esa marca, no solo Casa Matriz.

No se crea una fila `QrCode`. El QR de Settings se genera en el cliente apuntando a la URL pública.

Conflictos típicos:

- `409 TENANT_SLUG_TAKEN` — ese slug de restaurante ya existe en toda la plataforma.
- `409 OWNER_EMAIL_TAKEN` — ese email ya es un usuario (el email es único **global**, no por restaurante).
- `422 PLAN_NOT_CONFIGURED` — no hay ningún Plan en la base.

---

## 4. Slug del restaurante (`tenantSlug`)

Identificador **público y estable** de la marca. Va en la URL.

- Formato: minúsculas, números y guiones (`don-luigi`, `pizzeria-sur`). Entre 2 y 80 caracteres.
- **Único en toda la plataforma.** No pueden existir dos Tenants `don-luigi`.
- No es el nombre comercial. El nombre se puede cambiar; el slug es la dirección de la carta.
- Ejemplo: `https://app…/m/don-luigi/centro` → `don-luigi` es el Tenant.

Elegilo corto, legible y sin datos personales. Evitá cambiarlo después: el QR impreso y los enlaces viejos dejarían de resolver.

---

## 5. Slug de la sucursal (`branchSlug`)

Identificador **público** de **ese local** dentro de la marca.

- Mismo formato de slug.
- **Único solo dentro del Tenant.** Dos restaurantes distintos pueden tener ambos una sucursal `centro`.
- Junto al slug del Tenant forma la carta de ese local: `/m/{tenantSlug}/{branchSlug}`.
- Cada sucursal tiene su propio QR, contacto, banner y (a futuro) disponibilidad de productos/promos.

Ejemplos para la misma marca `don-luigi`:

| Local | `branchSlug` | URL pública |
|---|---|---|
| Casa central | `centro` | `/m/don-luigi/centro` |
| Local del shopping | `alto-palermo` | `/m/don-luigi/alto-palermo` |
| Un solo local (caso típico al alta) | `casa-matriz` | `/m/don-luigi/casa-matriz` |

Si el cliente tiene **un solo local**, igual hace falta un slug de sucursal: el modelo no admite un Tenant sin Branch. Usá algo estable (`casa-matriz`, `centro`, el barrio).

---

## 6. Caso A — Un dueño, un restaurante (lo habitual hoy)

Persona que no tiene otra marca en la plataforma.

**Pasos (plataforma):**

1. Entrar a `/admin/platform` como `PLATFORM_ADMIN`.
2. **Nuevo restaurante**.
3. Nombre comercial (lo que ve el comensal).
4. Slug del restaurante (único global).
5. Nombre de sucursal o dejar vacío → `Casa Matriz`.
6. Slug de sucursal (único dentro de esa marca).
7. Nombre, email y contraseña del dueño. El email **no** puede estar usado por otro usuario.
8. Crear. El listado muestra estado `TRIAL` (esperado).

**Pasos (dueño):**

1. Login en `/admin/login` con ese email/contraseña.
2. Cargar catálogo, branding y contacto en `/admin/settings`.
3. Descargar el QR de esa pantalla. Apunta a `/m/{tenantSlug}/{branchSlug}`.

Un User `OWNER` tiene `tenantId` de **ese** Tenant. Con un solo login administra esa marca y, cuando existan, todas sus sucursales.

---

## 7. Cómo manejar estados (sucursal vs. falta de pago)

Son **dos palancas distintas**:

| Querés… | Qué cambiar | Dónde | Efecto en la URL |
|---|---|---|---|
| Avisar que el local está de vacaciones u obras | Estado de la **sucursal** (`OPEN` / `CLOSED_TEMPORARILY` / `MAINTENANCE`) | Panel del dueño → **Configuración** (`/admin/settings`) | El enlace **sigue funcionando**; la carta muestra un aviso |
| Cortar el servicio porque no pagó | Estado de la **cuenta** (`SUSPENDED`) | Consola → **Gestión Global** (`/admin/platform`) → Suspender | El QR/enlace muestra “menú no disponible”; el dueño no entra al panel |
| Volver a dar servicio | Cuenta → `ACTIVE` | Misma pantalla → Reactivar | Carta y panel del dueño vuelven |

No uses “cerrada temporalmente” para un impago: el dueño podría reabrirla solo. La suspensión de cuenta la controlás vos.

---

## 7.1 El dueño olvidó la contraseña

No hay mail de “olvidé mi clave” en el piloto. Desde `/admin/platform` → **Resetear clave** del restaurante. Poné una clave nueva (mín. 8), pasásela al dueño por WhatsApp o similar, y que entre en `/admin/login`. Las sesiones que tuviera abiertas se cierran.

Si está logueado y quiere cambiarla él: `/admin/account`.

---

## 8. Caso B — Una marca, varios locales (cadena)

“El dueño tiene más de un restaurante” **de la misma marca** (Don Luigi Centro + Don Luigi Norte) = **un Tenant, varias Branches**.

Eso es lo que el dominio ya define:

- El `OWNER` tiene alcance `TENANT` (`branchId` nulo) → ve todas las sucursales.
- El Plan limita cuántas sucursales se pueden crear (`maxBranches`).
- Cada local tiene slug, URL y QR propios.
- El catálogo es del Tenant; la disponibilidad puede variar por sucursal.

**Alta de un local extra:** `/admin/branches` → Nueva sucursal (nombre + slug + “usar el mismo menú que” otra sucursal de **ese** Tenant). El Plan corta en `maxBranches`. Configuración, QR y estado operativo aplican a la sucursal activa del selector (header; el selector solo aparece si hay más de un local). **No** des de alta un segundo Tenant para el segundo local de la misma marca.

Un dueño **no ve** sucursales de otro restaurante: el JWT lleva un solo `tenantId`. Dos marcas distintas = dos logins (Caso C), no un selector de restaurantes.

---

## 9. Caso C — Una persona, dos marcas distintas

Dos negocios independientes (una pizzería y un café, cada uno con su marca, plan y carta) = **dos Tenants**.

**Limitación actual del modelo (no improvisar otra):**

- `User.tenantId` es **uno**. Un login pertenece a un solo Tenant.
- `User.email` es **único en la plataforma**. El mismo correo no puede ser dueño de dos Tenants.

**Cómo operarlo hoy:** dos altas en `/admin/platform`, cada una con **email distinto** (por ejemplo `ana@marca-a.com` y `ana@marca-b.com`, o un alias). Son dos dueños a nivel sistema, aunque en la vida real sea la misma persona.

Unificar un único login para varios Tenants **no está implementado** y contradiría el `tenantId` singular del User. Si se necesita, es una decisión de producto/arquitectura (hay que documentarla en `domain-modules.md` antes de codear).

---

## 10. Cómo elegir entre B y C

| Pregunta | Si la respuesta es sí | Alta correcta |
|---|---|---|
| ¿Misma marca, mismo menú base, mismos dueños legales? | Varios locales de una cadena | **Un Tenant**, varias sucursales (Caso B) |
| ¿Marcas distintas, cartas distintas, cobro separado? | Dos clientes / dos contratos | **Dos Tenants**, dos emails de dueño (Caso C) |
| ¿Un solo local y no prevé otro? | Independiente | **Un Tenant + una sucursal** (Caso A). Igual hay slug de sucursal. |

---

## 11. Roles (para no mezclarlos)

| Rol | Pertenece a un Tenant | Alcance |
|---|---|---|
| `PLATFORM_ADMIN` | No (`tenantId` nulo) | Toda la plataforma. Impersona con `X-Tenant-Id`. |
| `OWNER` | Sí | Toda la marca (todas las sucursales). Facturación, usuarios, catálogo. |
| `ADMIN` | Sí | Catálogo / sucursales / analítica, sin facturación. Puede acotarse a una sucursal. |
| `STAFF` | Sí | Operación de **una** sucursal (ej. marcar agotado). |

El alta de plataforma solo crea el `OWNER`. Invitar `ADMIN`/`STAFF` es un flujo posterior.

---

## 12. Relación rápida

```text
Plataforma
 └── Tenant "Don Luigi"          slug: don-luigi     status: TRIAL
      ├── User Ana  OWNER        email único global
      ├── Branch Centro          slug: centro        URL /m/don-luigi/centro
      └── Branch Norte           slug: norte         URL /m/don-luigi/norte
```
