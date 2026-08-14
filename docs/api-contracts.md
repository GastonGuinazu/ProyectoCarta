# Contratos de API (Request/Response Schemas)

> **Documento**: Especificación de Contratos de API
> **Proyecto**: ProyectoCarta — SaaS Multi-Tenant de Menú Digital PWA para Restaurantes
> **Estado**: Fase de Diseño (sin código de implementación — solo contratos JSON)
> **Relacionado con**: `architecture.md`, `domain-modules.md`, `features-spec.md`

---

## 1. Introducción y Alcance

Este documento define el **contrato exacto de request/response** de los tres endpoints más críticos del sistema, como base para la futura implementación en NestJS. No se define aquí ningún detalle de implementación (controllers, DTOs de clase, esquema de Prisma): únicamente la **forma del JSON** que viaja por la red, sus tipos de datos y sus códigos de estado HTTP.

Los tres endpoints cubiertos en detalle son:

1. **Menú Público** — `GET /api/v1/menu/public/:tenantSlug/:branchSlug`
2. **Autenticación del Backoffice** — `POST /api/v1/admin/auth/login` (y, en §4.4, los compañeros `refresh` / `logout` por cookie)
3. **Creación de Producto (Panel Admin)** — `POST /api/v1/admin/catalog/products`

La terminología de entidades (Tenant, Branch, Category, Product, Combo, Variant, Promo, Happy Hour, MediaAsset, etc.) es la misma definida en `domain-modules.md`. Las reglas de negocio referenciadas (solapamiento de promos, herencia de visibilidad, fallback de idioma, rate limiting) son las especificadas en `features-spec.md`.

---

## 2. Convenciones Generales de la API

| Convención | Definición |
|---|---|
| **Versionado** | Todas las rutas están prefijadas con `/api/v1/`. Un cambio incompatible de contrato implica `/api/v2/`, nunca una modificación silenciosa de `v1`. |
| **Formato** | JSON exclusivamente (`Content-Type: application/json`), tanto en request como en response. |
| **Casing** | `camelCase` para todas las claves JSON. |
| **Fechas y horas** | Formato **ISO 8601** con offset o `Z` (UTC), ej. `2026-08-12T22:00:00Z`. Nunca timestamps Unix crudos. |
| **Dinero** | Todo campo monetario se expresa como **entero en unidad menor de la moneda (centavos)** — ej. `$1250.50` ARS se representa como `125050` — para evitar errores de precisión de punto flotante. Cada monto va siempre acompañado de su campo `currency` (código ISO 4217, ej. `"ARS"`, `"USD"`). |
| **Campos traducibles** | Se representan como un objeto `{ "<códigoIdioma>": "<valor>" }` (ej. `{ "es": "Café con leche", "en": "Latte" }`), nunca como un string plano, siguiendo la estrategia i18n de `features-spec.md` §6. |
| **Identificadores** | Todos los `id` son strings (UUID v4 conceptual), nunca enteros autoincrementales expuestos públicamente. |
| **Autenticación** | Endpoints públicos: sin autenticación. Endpoints `/admin/*` (salvo `POST /admin/auth/login`, `POST /admin/auth/refresh` y `POST /admin/auth/logout`): header `Authorization: Bearer <jwt>` obligatorio. El refresh viaja en cookie `HttpOnly`, no en el JSON (`features-spec.md` §7.2). |
| **Rate Limiting** | Toda respuesta incluye los headers `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `X-RateLimit-Reset`. Al exceder el límite, se responde `429 Too Many Requests` (ver §6 de este documento y `features-spec.md` §7.3–7.4). |
| **Envoltorio de error** | Todo error (4xx/5xx) responde con el mismo esquema, documentado en §3. |

### 2.1 Esquema Común de Error

Todas las respuestas de error de los tres endpoints (y, por extensión, de toda la API) deben seguir esta forma:

```json
{
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "No se encontró un restaurante activo con ese identificador.",
    "statusCode": 404,
    "traceId": "a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7",
    "details": []
  }
}
```

- `code`: identificador estable en `SCREAMING_SNAKE_CASE`, pensado para lógica de manejo en el frontend (no debe parsearse `message`).
- `message`: texto legible, pensado para mostrarse o loguearse; puede variar de idioma/redacción sin romper integraciones.
- `details`: array opcional de errores de campo específicos (ver ejemplo de validación en §5.3).
- `traceId`: identificador de correlación para soporte/observabilidad, nunca información sensible.

### 2.2 `GET /api/v1/health`

Liveness del proceso Nest en Railway. Público, sin JWT ni tenant. No consulta Postgres. Respuesta `200`:

```json
{ "status": "ok" }
```

CORS: allowlist `PUBLIC_WEB_ORIGIN` (origen del front en Vercel). Healthcheck del host no manda `Origin`.

---

## 3. `GET /api/v1/menu/public/:tenantSlug/:branchSlug`

### 3.1 Propósito

Endpoint consumido por la **PWA pública del comensal** tras escanear el QR de una mesa/sucursal (ver flujo en `architecture.md` §3.2). Debe devolver, **en una sola llamada**, todo lo necesario para renderizar el menú completo y habilitar la estrategia **offline-first** descrita en `architecture.md` §4.2: jerarquía de categorías, productos con variantes, tags de alérgenos/dietas ya resueltos, y las promociones/Happy Hours **ya evaluadas por el backend** (nunca confiando en el reloj del dispositivo, según `features-spec.md` §3.3).

### 3.2 Autenticación y Autorización

Ninguna. Acceso público de solo lectura (`features-spec.md` §7.1).

### 3.3 Parámetros de Ruta

| Parámetro | Tipo | Descripción |
|---|---|---|
| `tenantSlug` | `string` | Slug único global del Tenant (ver `domain-modules.md` §2.2). |
| `branchSlug` | `string` | Slug de la Sucursal, único dentro del Tenant. |

### 3.4 Parámetros de Query (opcionales)

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `lang` | `string` | ninguno | Si se envía, el servidor **además** informa en `meta.requestedLanguage` cuál fue el idioma solicitado, a modo informativo. El payload siempre incluye **todos** los idiomas disponibles del tenant (ver §3.6), para permitir el cambio de idioma instantáneo en cliente sin nueva llamada de red, igual que el filtrado de alérgenos (`features-spec.md` §5.4 y §6.3). |
| `ifNoneMatch` | — | — | Se recomienda soportar el header estándar `If-None-Match` con `meta.menuVersion` como `ETag`, devolviendo `304 Not Modified` cuando no hubo cambios, para optimizar la estrategia *Stale-While-Revalidate*. |

### 3.5 Response `200 OK`

```json
{
  "meta": {
    "menuVersion": "7f3a9c2e",
    "generatedAt": "2026-08-12T22:00:00Z",
    "defaultLanguage": "es",
    "availableLanguages": ["es", "en", "pt"],
    "requestedLanguage": "es",
    "features": {
      "webArEnabled": true,
      "i18nEnabled": true
    }
  },
  "tenant": {
    "id": "8f14e45f-ceea-4d2a-b1f5-111111111111",
    "slug": "don-luigi",
    "name": "Pizzería Don Luigi",
    "branding": {
      "primaryColor": "#C0392B",
      "logoUrl": "https://res.cloudinary.com/proyectocarta/don-luigi/logo.webp"
    }
  },
  "branch": {
    "id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    "slug": "centro",
    "name": "Don Luigi - Centro",
    "timezone": "America/Argentina/Buenos_Aires",
    "address": "Av. Siempre Viva 742",
    "phone": "+5491122223333",
    "whatsapp": "+5491122223333",
    "instagram": "@donluigi",
    "bannerUrl": "https://xxxx.supabase.co/storage/v1/object/public/menu-assets/tenant/branch/branding/portada.webp",
    "operationalStatus": "OPEN"
  },
  "catalogs": {
    "allergens": [
      { "id": "alg-gluten", "code": "GLUTEN", "name": { "es": "Gluten", "en": "Gluten" }, "iconUrl": "https://cdn.proyectocarta.com/icons/gluten.svg" },
      { "id": "alg-lactose", "code": "DAIRY", "name": { "es": "Lácteos", "en": "Dairy" }, "iconUrl": "https://cdn.proyectocarta.com/icons/dairy.svg" }
    ],
    "dietaryTags": [
      { "id": "diet-vegan", "code": "VEGAN", "name": { "es": "Vegano", "en": "Vegan" }, "iconUrl": "https://cdn.proyectocarta.com/icons/vegan.svg" },
      { "id": "diet-gluten-free", "code": "GLUTEN_FREE", "name": { "es": "Sin TACC", "en": "Gluten-Free" }, "iconUrl": "https://cdn.proyectocarta.com/icons/gluten-free.svg" }
    ]
  },
  "categories": [
    {
      "id": "cat-bebidas",
      "slug": "bebidas",
      "name": { "es": "Bebidas", "en": "Drinks" },
      "description": { "es": "Nuestra selección de bebidas", "en": "Our drink selection" },
      "order": 1,
      "imageUrl": "https://res.cloudinary.com/proyectocarta/categories/bebidas.webp",
      "products": [],
      "children": [
        {
          "id": "cat-bebidas-calientes",
          "slug": "bebidas-calientes",
          "name": { "es": "Bebidas Calientes", "en": "Hot Drinks" },
          "description": null,
          "order": 1,
          "imageUrl": null,
          "children": [],
          "products": [
            {
              "id": "prod-cafe-con-leche",
              "slug": "cafe-con-leche",
              "name": { "es": "Café con Leche", "en": "Latte" },
              "description": { "es": "Espresso con leche vaporizada", "en": "Espresso with steamed milk" },
              "basePrice": 350000,
              "currency": "ARS",
              "availability": "AVAILABLE",
              "order": 1,
              "allergenIds": ["alg-lactose"],
              "dietaryTagIds": [],
              "servedStartMinuteOfDay": null,
              "servedEndMinuteOfDay": null,
              "outsideServingHours": false,
              "images": {
                "thumbnailUrl": "https://res.cloudinary.com/proyectocarta/products/cafe-con-leche_thumb.webp",
                "detailUrl": "https://res.cloudinary.com/proyectocarta/products/cafe-con-leche_detail.webp"
              },
              "webAr": {
                "enabled": false,
                "assetUrl": null,
                "modelUrl": null
              },
              "variantGroups": [
                {
                  "id": "vg-tamano",
                  "name": { "es": "Tamaño", "en": "Size" },
                  "selectionType": "SINGLE",
                  "required": true,
                  "options": [
                    { "id": "vo-chico", "name": { "es": "Chico", "en": "Small" }, "priceDelta": 0, "available": true },
                    { "id": "vo-grande", "name": { "es": "Grande", "en": "Large" }, "priceDelta": 80000, "available": true }
                  ]
                }
              ],
              "activePromotion": null
            },
            {
              "id": "prod-medialuna",
              "slug": "medialuna",
              "name": { "es": "Medialuna", "en": "Croissant" },
              "description": { "es": "Medialuna de manteca", "en": "Butter croissant" },
              "basePrice": 150000,
              "currency": "ARS",
              "availability": "AVAILABLE",
              "order": 2,
              "allergenIds": ["alg-gluten", "alg-lactose"],
              "dietaryTagIds": [],
              "servedStartMinuteOfDay": 420,
              "servedEndMinuteOfDay": 720,
              "outsideServingHours": false,
              "images": {
                "thumbnailUrl": "https://res.cloudinary.com/proyectocarta/products/medialuna_thumb.webp",
                "detailUrl": "https://res.cloudinary.com/proyectocarta/products/medialuna_detail.webp"
              },
              "webAr": {
                "enabled": true,
                "assetUrl": "https://res.cloudinary.com/proyectocarta/products/medialuna_ar.png",
                "modelUrl": "https://xxxx.supabase.co/storage/v1/object/public/menu-assets/tenant/product/medialuna.glb"
              },
              "variantGroups": [],
              "activePromotion": {
                "id": "promo-happy-hour-desayuno",
                "kind": "HAPPY_HOUR",
                "name": { "es": "Happy Hour Desayuno", "en": "Breakfast Happy Hour" },
                "badgeLabel": { "es": "Happy Hour", "en": "Happy Hour" },
                "discountType": "PERCENTAGE",
                "originalPrice": 150000,
                "finalPrice": 120000
              }
            }
          ]
        }
      ]
    }
  ],
  "combos": [
    {
      "id": "combo-desayuno",
      "slug": "combo-desayuno",
      "name": { "es": "Combo Desayuno", "en": "Breakfast Combo" },
      "description": { "es": "Café con leche + 2 medialunas", "en": "Latte + 2 croissants" },
      "price": 420000,
      "currency": "ARS",
      "imageUrl": "https://res.cloudinary.com/proyectocarta/combos/combo-desayuno.webp",
      "availability": "AVAILABLE",
      "items": [
        { "productId": "prod-cafe-con-leche", "quantity": 1 },
        { "productId": "prod-medialuna", "quantity": 2 }
      ],
      "activePromotion": null
    }
  ]
}
```

### 3.6 Notas de Diseño del Payload

- **Árbol de categorías anidado** (`children` recursivo) en vez de lista plana con `parentId`: se prioriza que el frontend renderice directamente sin tener que reconstruir el árbol en cliente, alineado con "optimizado para el frontend" pedido en el requisito.
- **`activePromotion` ya resuelto por el backend**: el frontend nunca decide si una Promo/Happy Hour está vigente ni qué precio final corresponde; solo pinta lo que el backend ya evaluó (regla de `features-spec.md` §3.3, evaluación en backend, nunca en el reloj del dispositivo).
- **`outsideServingHours` ya resuelto por el backend** con `Branch.timezone`: el plato sigue en el árbol; la carta lo muestra atenuado. `servedStartMinuteOfDay` / `servedEndMinuteOfDay` son minutos `[0, 1439]` (fin exclusivo, puede cruzar medianoche); ambos `null` = sin recorte horario (`features-spec.md` §2.6).
- **`allergenIds`/`dietaryTagIds` por referencia + catálogo embebido una sola vez** en `catalogs.allergens`/`catalogs.dietaryTags`: evita repetir el objeto completo del tag en cada producto, y habilita el filtrado 100% client-side e instantáneo descrito en `features-spec.md` §5.4.
- **Todas las traducciones embebidas** (no solo el idioma solicitado): permite el selector de idioma instantáneo sin nueva llamada de red (`features-spec.md` §6.3), coherente con la estrategia offline-first.
- **`meta.menuVersion`**: hash/versión del catálogo de esa sucursal en ese momento, pensado como `ETag` para la estrategia *Stale-While-Revalidate* de `architecture.md` §4.2.

### 3.7 Respuestas de Error

```json
{
  "error": {
    "code": "TENANT_OR_BRANCH_NOT_FOUND",
    "message": "El menú solicitado no existe o no está disponible.",
    "statusCode": 404,
    "traceId": "b2c3d4e5-f6a7-4890-b1c2-d3e4f5a6b7c8",
    "details": []
  }
}
```

| Código HTTP | `error.code` | Cuándo ocurre |
|---|---|---|
| `404` | `TENANT_OR_BRANCH_NOT_FOUND` | El slug de tenant o sucursal no existe. Se responde el mismo código genérico para no filtrar si el problema es el tenant o la sucursal. |
| `404` | `TENANT_SUSPENDED` | El Tenant está suspendido (ver `architecture.md` §3, regla de suspensión); se muestra como "menú no disponible", nunca como error técnico. |
| `304` | — | El `menuVersion` enviado en `If-None-Match` coincide con la versión actual; no hay body. |
| `429` | `RATE_LIMIT_EXCEEDED` | Se superó el límite de tasa aplicable (por IP + sesión anónima + sucursal, ver `features-spec.md` §7.3). |

---

## 4. `POST /api/v1/admin/auth/login`

### 4.1 Propósito

Inicio de sesión del Panel Admin para `PLATFORM_ADMIN`, Owners, Admins y Staff (ver `domain-modules.md` §2.2, entidad `Owner/User`). NestJS es la única autoridad de identidad (`architecture.md` §2.3): valida `User.passwordHash` (Argon2id) y emite el JWT de sesión de aplicación. El body JSON trae el contexto (usuario, tenant si aplica, roles, sucursales) para que el frontend no necesite una segunda llamada. El **refresh token no viaja en el JSON**.

### 4.2 Autenticación y Autorización

Ninguna previa (es el propio endpoint de login; marcado `@Public()`). Debe estar protegido por **rate limiting agresivo** y bloqueo progresivo ante intentos fallidos repetidos, para mitigar ataques de fuerza bruta (`features-spec.md` §7.3).

### 4.3 Request Body

```json
{
  "email": "gaston@donluigi.com",
  "password": "un-password-seguro-del-usuario"
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `email` | `string` | Sí | Formato de email válido. |
| `password` | `string` | Sí | Nunca se loguea ni se refleja en respuestas de error. |

### 4.4 Response `200 OK`

El `refreshToken` se entrega **solo** como cookie (`Set-Cookie`), nunca en el body ni para que Angular lo guarde en memoria/`localStorage`.

Cookie de refresh (atributos obligatorios):

- Nombre conceptual: `pc_refresh` (el nombre concreto sale de configuración, no hardcodeado en clientes).
- `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/admin/auth`
- Host-only del host de la API (en producción `api.<dominio>`). No se setea `Domain=.proyectocarta.com` (`docs/hosting.md`).
- Valor: token **opaco** (no JWT), rotativo, persistido hasheado en BD. Reuse detection: si se presenta un refresh ya rotado, se revoca la familia entera.
- El cliente no lee esta cookie; el navegador la reenvía en `POST /admin/auth/refresh` y `POST /admin/auth/logout`.

**Usuario de tenant (`OWNER` / `ADMIN` / `STAFF`):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItMTIzIn0.signature",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "usr-8f14e45f",
    "fullName": "Gastón Guiñazú",
    "email": "gaston@donluigi.com",
    "preferredLanguage": "es",
    "status": "ACTIVE"
  },
  "tenant": {
    "id": "8f14e45f-ceea-4d2a-b1f5-111111111111",
    "slug": "don-luigi",
    "name": "Pizzería Don Luigi",
    "plan": "PRO"
  },
  "roleAssignments": [
    { "role": "OWNER", "scope": "TENANT", "branchId": null },
    { "role": "STAFF", "scope": "BRANCH", "branchId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301" }
  ],
  "accessibleBranches": [
    { "id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301", "slug": "centro", "name": "Don Luigi - Centro" },
    { "id": "4a2604e0-5f89-11d3-9a0c-0305e82c3402", "slug": "norte", "name": "Don Luigi - Norte" }
  ]
}
```

**Operador de plataforma (`PLATFORM_ADMIN`):** el mismo esquema, con `tenant: null`, `accessibleBranches: []` y una única asignación `{ "role": "PLATFORM_ADMIN", "scope": "PLATFORM", "branchId": null }`.

| Campo | Tipo | Descripción |
|---|---|---|
| `accessToken` | `string` | JWT de corta duración (`expiresIn` segundos, ~900) para autorizar cada request administrativa. Solo memoria en el cliente (`AuthStore`). |
| `tokenType` | `string` | Siempre `"Bearer"`. |
| `expiresIn` | `number` | Segundos de vida del `accessToken`. |
| `tenant` | `object \| null` | Contexto del Tenant de la sesión. `null` únicamente para `PLATFORM_ADMIN` (hasta impersonar). |
| `roleAssignments` | `array` | Modelo RBAC de `domain-modules.md` §2.2: alcance `PLATFORM` (solo `PLATFORM_ADMIN`), `TENANT` (ej. Owner) o `BRANCH` (ej. Staff). |
| `accessibleBranches` | `array` | Sucursales visibles para el selector del Panel Admin. Vacío para `PLATFORM_ADMIN`. |

Endpoints compañeros (mismo módulo `AuthModule`; no se detalla un schema JSON adicional aquí):

- `POST /api/v1/admin/auth/refresh` — `@Public()` respecto del Bearer; usa la cookie de refresh; rota el refresh y devuelve un nuevo `accessToken` (mismo shape de sesión que el login, sin volver a pedir password).
- `POST /api/v1/admin/auth/logout` — revoca la familia de refresh tokens y caduca la cookie.
- `POST /api/v1/admin/auth/change-password` — JWT obligatorio. Body `{ "currentPassword", "newPassword" }` (`newPassword` mín. 8). Respuesta `204`; rota el refresh de esta sesión y revoca el resto. No es `401` si la clave actual falla (`400 CURRENT_PASSWORD_INVALID`) para no confundir con JWT vencido. `@SkipTenantContext()`: opera sobre el `sub` del JWT, no sobre el Tenant impersonado.

### 4.5 Estructura Conceptual del JWT (`accessToken` decodificado)

> Documentado a nivel de **contrato de claims**, no de implementación (ver `features-spec.md` §7.2). No se meten permisos finos en el JWT: rol + scope bastan; el `RolesGuard` interpreta. El `tenantId` operable de un usuario de tenant sale **solo** de estos claims.

**Usuario de tenant:**

```json
{
  "sub": "usr-8f14e45f",
  "tenantId": "8f14e45f-ceea-4d2a-b1f5-111111111111",
  "roles": [
    { "role": "OWNER", "scope": "TENANT", "branchId": null },
    { "role": "STAFF", "scope": "BRANCH", "branchId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301" }
  ],
  "iat": 1786000000,
  "exp": 1786000900
}
```

**Operador de plataforma:**

```json
{
  "sub": "usr-platform-01",
  "tenantId": null,
  "roles": [
    { "role": "PLATFORM_ADMIN", "scope": "PLATFORM", "branchId": null }
  ],
  "iat": 1786000000,
  "exp": 1786000900
}
```

### 4.6 Respuestas de Error

| Código HTTP | `error.code` | Cuándo ocurre |
|---|---|---|
| `401` | `INVALID_CREDENTIALS` | Email inexistente o password incorrecta. Mensaje genérico para no revelar cuál de los dos campos falló. |
| `403` | `ACCOUNT_DISABLED` | El usuario existe pero está deshabilitado o es una invitación pendiente de aceptar (`domain-modules.md` §2.2). |
| `403` | `TENANT_SUSPENDED` | El Tenant al que pertenece el usuario está suspendido. No aplica a `PLATFORM_ADMIN`. |
| `429` | `RATE_LIMIT_EXCEEDED` | Demasiados intentos de login desde el mismo origen en poco tiempo. |

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email o contraseña incorrectos.",
    "statusCode": 401,
    "traceId": "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9",
    "details": []
  }
}
```

---

## 5. `POST /api/v1/admin/catalog/products`

### 5.1 Propósito

Creación de un `Product` desde el Panel Admin (ver `domain-modules.md` §3.2). El payload debe contemplar: referencia a su `Category`, precios, referencias a tags de alérgenos/dietas (catálogo estandarizado de plataforma, `features-spec.md` §5.1–5.3), variantes, disponibilidad por sucursal, y la metadata necesaria para **inicializar el pipeline de WebAR** en el backend (`domain-modules.md` §5.3).

> **Nota de diseño**: la subida binaria de imágenes/video se realiza previamente contra el módulo de Media (fuera del alcance de este documento). Este endpoint solo **referencia** `MediaAsset`s ya subidos por su `id`; no acepta archivos binarios en el body.

### 5.2 Autenticación y Autorización

- Header `Authorization: Bearer <accessToken>` obligatorio.
- Requiere Rol `OWNER` o `ADMIN` sobre el Tenant/Sucursal indicada, o `PLATFORM_ADMIN` impersonando ese Tenant (`X-Tenant-Id`). El Rol `STAFF` no puede crear productos (`features-spec.md` §7.2, `domain-modules.md` §2.2).

### 5.3 Request Body

```json
{
  "categoryId": "cat-bebidas-calientes",
  "name": {
    "es": "Café con Leche",
    "en": "Latte"
  },
  "description": {
    "es": "Espresso con leche vaporizada",
    "en": "Espresso with steamed milk"
  },
  "basePrice": 350000,
  "currency": "ARS",
  "sku": "BEB-CAFE-001",
  "order": 1,
  "allergenIds": ["alg-lactose"],
  "dietaryTagIds": [],
  "servedStartMinuteOfDay": null,
  "servedEndMinuteOfDay": null,
  "branchAvailability": {
    "mode": "ALL_BRANCHES",
    "branchIds": []
  },
  "media": {
    "primaryMediaAssetId": "media-8f14e45f",
    "galleryMediaAssetIds": ["media-8f14e45f", "media-9a25f56g"],
    "ar": {
      "enabled": true,
      "sourceMediaAssetId": "media-8f14e45f"
    }
  },
  "variantGroups": [
    {
      "name": { "es": "Tamaño", "en": "Size" },
      "selectionType": "SINGLE",
      "required": true,
      "options": [
        { "name": { "es": "Chico", "en": "Small" }, "priceDelta": 0 },
        { "name": { "es": "Grande", "en": "Large" }, "priceDelta": 80000 }
      ]
    }
  ]
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `categoryId` | `string` | Sí | Debe referenciar una `Category` existente del mismo Tenant. |
| `name` | `object` (traducible) | Sí | Debe incluir, como mínimo, la clave del idioma por defecto del Tenant/Sucursal (`features-spec.md` §6.4). |
| `description` | `object` (traducible) | No | — |
| `basePrice` | `integer` | Sí | En centavos, ver convención de dinero (§2). |
| `currency` | `string` | Sí | Código ISO 4217. |
| `sku` | `string` | No | Identificador interno opcional del restaurante. |
| `allergenIds` / `dietaryTagIds` | `array<string>` | No | Deben referenciar ids del catálogo estandarizado de plataforma (`features-spec.md` §5.1–5.2); no se aceptan tags libres. |
| `servedStartMinuteOfDay` / `servedEndMinuteOfDay` | `integer` \| `null` | No | Minutos `[0, 1439]` en la zona IANA de la sucursal. Van en par (ambos o ninguno). Fin exclusivo, igual que Happy Hour. `null`/`omitido` = se sirve todo el día. |
| `branchAvailability.mode` | `enum` | Sí | `"ALL_BRANCHES"` o `"SPECIFIC_BRANCHES"`. Si es `SPECIFIC_BRANCHES`, `branchIds` no puede ser vacío. |
| `media.primaryMediaAssetId` | `string` | Sí | Referencia a un `MediaAsset` ya subido y procesado (estado `ready`, ver `domain-modules.md` §5.4). |
| `media.ar.enabled` | `boolean` | Sí | Si es `true`, dispara de forma asíncrona el pipeline de recorte de fondo con IA sobre `sourceMediaAssetId` (`domain-modules.md` §5.3). |
| `variantGroups[].selectionType` | `enum` | Sí (si hay variantes) | `"SINGLE"` o `"MULTIPLE"` (`domain-modules.md` §3.2). |

### 5.4 Response `201 Created`

```json
{
  "id": "prod-cafe-con-leche",
  "slug": "cafe-con-leche",
  "categoryId": "cat-bebidas-calientes",
  "name": { "es": "Café con Leche", "en": "Latte" },
  "description": { "es": "Espresso con leche vaporizada", "en": "Espresso with steamed milk" },
  "basePrice": 350000,
  "currency": "ARS",
  "sku": "BEB-CAFE-001",
  "order": 1,
  "availability": "AVAILABLE",
  "allergenIds": ["alg-lactose"],
  "dietaryTagIds": [],
  "branchAvailability": {
    "mode": "ALL_BRANCHES",
    "branchIds": []
  },
  "media": {
    "primaryMediaAssetId": "media-8f14e45f",
    "galleryMediaAssetIds": ["media-8f14e45f", "media-9a25f56g"],
    "ar": {
      "enabled": true,
      "sourceMediaAssetId": "media-8f14e45f",
      "pipelineStatus": "PROCESSING"
    }
  },
  "variantGroups": [
    {
      "id": "vg-tamano",
      "name": { "es": "Tamaño", "en": "Size" },
      "selectionType": "SINGLE",
      "required": true,
      "options": [
        { "id": "vo-chico", "name": { "es": "Chico", "en": "Small" }, "priceDelta": 0, "available": true },
        { "id": "vo-grande", "name": { "es": "Grande", "en": "Large" }, "priceDelta": 80000, "available": true }
      ]
    }
  ],
  "createdAt": "2026-08-12T22:10:00Z",
  "updatedAt": "2026-08-12T22:10:00Z"
}
```

- `media.ar.pipelineStatus` refleja el estado asíncrono del pipeline de Media & AR (`domain-modules.md` §5.2, `pendiente | procesando | listo | error`); el Panel Admin debe consultar/escuchar la actualización de este estado (polling o Supabase Realtime) en lugar de asumir que el asset AR ya está listo inmediatamente tras la creación.

### 5.5 Respuestas de Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El payload contiene campos inválidos.",
    "statusCode": 400,
    "traceId": "d4e5f6a7-b8c9-4012-d3e4-f5a6b7c8d9e0",
    "details": [
      { "field": "name.es", "issue": "El nombre en el idioma por defecto del tenant es obligatorio." },
      { "field": "basePrice", "issue": "Debe ser un entero positivo." }
    ]
  }
}
```

| Código HTTP | `error.code` | Cuándo ocurre |
|---|---|---|
| `400` | `VALIDATION_ERROR` | El body no cumple el esquema (campos faltantes/tipos inválidos), con detalle por campo en `details`. |
| `401` | `UNAUTHORIZED` | Falta el JWT o es inválido/expirado. |
| `403` | `FORBIDDEN_ROLE` | El usuario autenticado no tiene Rol suficiente (ej. es `STAFF`). |
| `404` | `CATEGORY_NOT_FOUND` | El `categoryId` no existe o no pertenece al Tenant del usuario autenticado (aislamiento multi-tenant, ver `.cursor/rules/01-global-architecture.mdc`). |
| `404` | `MEDIA_ASSET_NOT_FOUND` | Alguno de los `mediaAssetId` referenciados no existe o no pertenece al Tenant. |
| `409` | `DUPLICATE_SKU` | El `sku` ya existe para ese Tenant. |
| `422` | `PLAN_LIMIT_EXCEEDED` | El Tenant alcanzó el límite de productos de su Plan actual (`domain-modules.md` §2.2, entidad Plan). |

### 5.6 `GET /api/v1/admin/catalog/categories`

Listado de categorías del tenant autenticado para selectores y gestión del Panel Admin. Mismos guards y contexto de tenant que el CRUD de productos. Ordenado por el campo `order` (posición visual; el schema Prisma no usa `sortOrder`).

```json
{
  "items": [
    {
      "id": "cat-bebidas-calientes",
      "name": { "es": "Bebidas calientes" },
      "order": 0,
      "productCount": 3,
      "childCount": 0
    }
  ]
}
```

### 5.6.1 `POST /api/v1/admin/catalog/categories`

Crea una categoría raíz. El `tenantId` sale del contexto autenticado. El slug se genera a partir del nombre. `order` queda al final de la lista del tenant.

Request:

```json
{ "name": { "es": "Postres" } }
```

Respuesta `201`: el mismo objeto de ítem que en el listado.

### 5.6.2 `PUT /api/v1/admin/catalog/categories/:id`

Actualiza el nombre traducible. `404 CATEGORY_NOT_FOUND` si el id no existe en ese tenant.

### 5.6.3 `DELETE /api/v1/admin/catalog/categories/:id`

Elimina una categoría vacía. `204` sin cuerpo. `409 CATEGORY_IN_USE` si tiene productos o subcategorías (features-spec.md §2.4: cascada/reasignar queda para un flujo posterior).

### 5.6.4 `PATCH /api/v1/admin/catalog/categories/reorder`

Recibe el orden completo de IDs del tenant y reescribe `order` (0-based, índice del array) en una sola transacción Prisma. El set de IDs debe coincidir exactamente con las categorías del tenant; si no, `409 CATEGORY_REORDER_MISMATCH`.

```json
{ "categoryIds": ["uuid-postres", "uuid-bebidas", "uuid-pizzas"] }
```

Respuesta `200`: el listado actualizado (misma forma que GET).

### 5.7 `GET /api/v1/admin/catalog/products/:id`

Detalle de un producto del tenant autenticado. Misma forma que la respuesta de creación (§5.4), sin disparar el pipeline de media. Incluye `allergenIds`, `dietaryTagIds`, `servedStartMinuteOfDay` y `servedEndMinuteOfDay`. `404 PRODUCT_NOT_FOUND` si el id no existe en ese tenant.

### `GET /api/v1/admin/catalog/tags`

Catálogo global de plataforma (alérgenos y tags dietéticos), misma forma que `catalogs` del menú público. El formulario de producto lo usa para marcar filtros. Auth: JWT + rol `ADMIN` o superior. Ruta fija (no `products/:id`).

```json
{
  "allergens": [{ "id": "alg-lactose", "code": "LACTOSE", "name": { "es": "Lactosa" }, "iconUrl": null }],
  "dietaryTags": [{ "id": "diet-vegan", "code": "VEGAN", "name": { "es": "Vegano" }, "iconUrl": null }]
}
```

### 5.8 `POST /api/v1/admin/catalog/products/:id/media`

Subida binaria (`multipart/form-data`, campo `file`) a **un slot** del producto. Query obligatorio `slot`:

| `slot` | Archivos | `ProductMedia.role` | Efecto |
|---|---|---|---|
| `presentation` | `.jpg`, `.png`, `.webp` (máx. 10 MB) | `PRIMARY` | Reemplaza la foto de presentación. No toca el modelo 3D. |
| `immersive` | `.glb`, `.usdz` (máx. 50 MB) | `AR_MODEL` | Reemplaza el modelo 3D opcional. No toca la foto. |

`400 MEDIA_SLOT_TYPE_MISMATCH` si el archivo no corresponde al slot. El archivo se guarda en Supabase Storage bajo `tenantId/productId/...`. El `tenantId` sale del contexto autenticado, nunca del body.

Respuesta `201` (`slot=presentation`):

```json
{
  "id": "media-uuid",
  "publicUrl": "https://xxxx.supabase.co/storage/v1/object/public/menu-assets/tenant/product/file.webp",
  "fileType": "IMAGE",
  "fileName": "foto.webp",
  "role": "PRIMARY"
}
```

Respuesta `201` (`slot=immersive`): el mismo esquema con `"fileType": "MODEL_3D"` y `"role": "AR_MODEL"`.

El detalle de producto (`GET .../products/:id`) expone ambas capas en `media.primaryUrl` (2D) y `media.arModel.url` (3D, o `null`).

#### `DELETE /api/v1/admin/catalog/products/:id/media`

Quita el archivo de **un slot** sin reemplazarlo. Query obligatorio `slot` (`presentation` | `immersive`), igual que el POST. Desvincula el `ProductMedia` de ese rol; si el `MediaAsset` no queda referenciado por otro producto, se borra de la base y de Supabase Storage. No toca el otro slot.

Respuesta `204` (también si el slot ya estaba vacío). `404 PRODUCT_NOT_FOUND` si el producto no existe en el tenant.

### 5.9 Combos admin

CRUD de `Combo` (`domain-modules.md` §3.2). Entidad separada de `Product`, con precio explícito (`price` en centavos) e ítems `ComboItem` (producto + cantidad). Mínimo dos productos distintos del mismo tenant. El `tenantId` sale del contexto autenticado.

#### `GET /api/v1/admin/catalog/combos`

```json
{
  "items": [
    {
      "id": "combo-uuid",
      "name": { "es": "Combo desayuno" },
      "price": 420000,
      "currency": "ARS",
      "availability": "AVAILABLE",
      "items": [
        { "productId": "prod-uuid-1", "quantity": 1, "productName": { "es": "Café con leche" } },
        { "productId": "prod-uuid-2", "quantity": 2, "productName": { "es": "Medialuna" } }
      ]
    }
  ]
}
```

#### `GET /api/v1/admin/catalog/combos/:id`

Detalle con `slug`, `description`, `imageUrl`, `createdAt`, `updatedAt`. `404 COMBO_NOT_FOUND`.

#### `POST /api/v1/admin/catalog/combos`

```json
{
  "name": { "es": "Combo desayuno" },
  "description": { "es": "Café + 2 medialunas" },
  "price": 420000,
  "availability": "AVAILABLE",
  "items": [
    { "productId": "prod-uuid-1", "quantity": 1 },
    { "productId": "prod-uuid-2", "quantity": 2 }
  ]
}
```

`201` con el detalle. `400 VALIDATION_ERROR` si hay menos de dos productos o IDs duplicados. `404 PRODUCT_NOT_FOUND` si algún ítem no pertenece al tenant.

#### `PUT /api/v1/admin/catalog/combos/:id`

Misma forma que el POST (campos opcionales). Reemplaza los ítems si se envía `items`.

#### `POST /api/v1/admin/catalog/combos/:id/media` y `DELETE .../media`

Foto representativa del combo (`domain-modules.md` §3.2). Imagen `.jpg` / `.png` / `.webp` (máx. 10 MB). **Sin** modelo 3D. Hay que crear el combo antes de subir. `GET`/`PUT` del combo incluyen `imageUrl` (null si no hay foto). `201` con `{ id, publicUrl, fileName }`. `DELETE` → `204`. `404 COMBO_NOT_FOUND`.

#### `DELETE /api/v1/admin/catalog/combos/:id`

`204`. Los `ComboItem` se eliminan en cascada. Un producto que todavía forma parte de un combo no se puede borrar (`409 PRODUCT_IN_USE`).

### 5.10 Settings de sucursal (`/api/v1/admin/settings/branch`)

Pantalla de identidad visual + contacto. El `tenantId` sale del JWT / `X-Tenant-Id`. La sucursal sale del header **`X-Branch-Id`** (selector del panel) si pertenece al tenant y el rol la cubre; si el header no viene, el MVP usa la sucursal más antigua (`createdAt`). Auth: JWT + rol `ADMIN` o superior.

La respuesta **no es el row crudo de `Branch`**: es un DTO compuesto.

- Marca (`commercialName`, `accentColor`, `logoUrl`) vive en `Tenant` (`name`, `brandPrimaryColor`, `logoMediaAssetId`).
- Contacto (`phone`, `whatsapp`, `instagram`, `address`) y portada (`bannerUrl`) viven en `Branch`.
- `logoUrl` / `bannerUrl` se resuelven desde `MediaAsset.originalUrl`. **No se aceptan URLs arbitrarias en el PATCH** (solo vía upload).

#### `GET /api/v1/admin/settings/branch`

```json
{
  "branchId": "00000000-0000-0000-0000-0000000000f3",
  "tenantSlug": "don-luigi",
  "branchSlug": "centro",
  "commercialName": "Don Luigi",
  "phone": "+54 11 4000-0000",
  "whatsapp": "+54 9 11 4000-0000",
  "instagram": "@donluigi",
  "address": "Av. Corrientes 1234, CABA",
  "accentColor": "#C0272D",
  "logoUrl": "https://xxxx.supabase.co/storage/v1/object/public/menu-assets/tenant/branch/branding/logo.webp",
  "bannerUrl": null,
  "operationalStatus": "OPEN",
  "timezone": "America/Argentina/Buenos_Aires"
}
```

`404 BRANCH_NOT_FOUND` si el tenant no tiene sucursal.

#### `PATCH /api/v1/admin/settings/branch`

Campos opcionales, misma forma que el GET **sin** `branchId` / `tenantSlug` / `branchSlug` / `logoUrl` / `bannerUrl`. `accentColor` es HEX `#RRGGBB`. `operationalStatus`: `OPEN` | `CLOSED_TEMPORARILY` | `MAINTENANCE` (aviso en la carta pública; **no** corta la URL). `timezone`: IANA (ej. `America/Argentina/Buenos_Aires`); Happy Hour y el horario de servicio de platos se evalúan con esta zona, no con el reloj del comensal. Respuesta `200` igual al GET.

En el Panel Admin, `/admin/settings` genera el QR de la carta y un enlace **Abrir carta**. El layout del panel también tiene **Ver carta** (`/m/{tenantSlug}/{branchSlug}`). No persiste un `QrCode` en este flujo.

#### `POST /api/v1/admin/settings/branch/logo` y `.../banner`

`multipart/form-data`, campo `file`. Imagen `.jpg` / `.png` / `.webp` (máx. 10 MB). Se guarda en Supabase Storage bajo `tenantId/branchId/branding/`. El logo se asocia 1:1 al Tenant; el banner 16:9 a la sucursal. Reemplazar uno no pisa al otro.

Respuesta `201`:

```json
{
  "id": "media-uuid",
  "publicUrl": "https://xxxx.supabase.co/storage/v1/object/public/menu-assets/tenant/branch/branding/file.webp",
  "fileName": "logo.webp",
  "slot": "logo"
}
```

#### `DELETE /api/v1/admin/settings/branch/logo` y `.../banner`

Quita el archivo de ese slot. Si el `MediaAsset` no queda referenciado, se borra de la base y de Storage. Respuesta `204` (también si el slot ya estaba vacío).

### 5.11 Alta de restaurantes (`/api/v1/admin/platform/tenants`)

Consola de plataforma. Auth: JWT + rol **solo** `PLATFORM_ADMIN`. **Sin** `TenantContext` obligatorio (Prisma crudo, `backend-architecture.md` §4.2).

El `OWNER` queda con `RoleAssignment.branchId = null` (alcance `TENANT`): administra todas las sucursales del Tenant.

#### `GET /api/v1/admin/platform/tenants`

Lista tenants, más reciente primero.

```json
[
  {
    "id": "uuid",
    "name": "Don Luigi",
    "slug": "don-luigi",
    "status": "TRIAL",
    "createdAt": "2026-08-13T22:00:00.000Z",
    "branchCount": 1,
    "ownerEmail": "dueno@ejemplo.com"
  }
]
```

#### `POST /api/v1/admin/platform/tenants`

Crea Tenant + Branch inicial + User `OWNER` en **una transacción**. El hash Argon2id se calcula **antes** de abrir la transacción. `planId` = el Plan más antiguo; si no hay Plan → `422 PLAN_NOT_CONFIGURED`. `branchName` vacío → `"Casa Matriz"`. Usuario `ACTIVE`.

```json
{
  "commercialName": "Pizzería Sur",
  "tenantSlug": "pizzeria-sur",
  "branchName": "Casa Matriz",
  "branchSlug": "casa-matriz",
  "ownerFullName": "Ana Pérez",
  "ownerEmail": "ana@pizzeriasur.com",
  "ownerPassword": "una-clave-segura"
}
```

Respuesta `201` (sin hash ni password):

```json
{
  "tenantId": "uuid",
  "tenantSlug": "pizzeria-sur",
  "tenantName": "Pizzería Sur",
  "status": "TRIAL",
  "branchId": "uuid",
  "branchSlug": "casa-matriz",
  "branchName": "Casa Matriz",
  "ownerId": "uuid",
  "ownerEmail": "ana@pizzeriasur.com"
}
```

| Código | Significado |
|---|---|
| `409 TENANT_SLUG_TAKEN` | `tenants.slug` único a nivel plataforma. |
| `409 OWNER_EMAIL_TAKEN` | `users.email` único a nivel plataforma. |
| `422 PLAN_NOT_CONFIGURED` | No hay filas en `plans`. |

#### `PATCH /api/v1/admin/platform/tenants/:id/status`

Cambia el estado de la cuenta. Body: `{ "status": "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED" }`. Auth: solo `PLATFORM_ADMIN`.

`SUSPENDED` / `CANCELLED`: el menú público responde `404 TENANT_SUSPENDED` y el dueño no puede autenticarse (`403 TENANT_SUSPENDED`). `TRIAL` y `ACTIVE` dejan la carta operativa. Reactivar desde la UI de plataforma envía `ACTIVE`.

Respuesta `200`: el mismo ítem de lista (id, name, slug, status, createdAt, branchCount, ownerEmail).

`404 TENANT_NOT_FOUND` si el id no existe.

#### `POST /api/v1/admin/platform/tenants/:id/reset-owner-password`

Reset manual de la clave del `OWNER` de ese Tenant (piloto: no hay recovery por email). Auth: solo `PLATFORM_ADMIN`. Body: `{ "newPassword": "…" }` (mín. 8, máx. 72). El hash Argon2id se calcula **antes** de la transacción; se actualiza `passwordHash` filtrando `id` + `tenantId` y se revocan todos los refresh del dueño.

Respuesta `200`: el mismo ítem de lista. `404 TENANT_NOT_FOUND` / `404 OWNER_NOT_FOUND`. El password no viaja en la respuesta.

### 5.12 Sucursales (`/api/v1/admin/branches`)

Listado y alta de locales del Tenant activo. Auth: JWT + rol `ADMIN` o superior. `@RequireTenantContext()`.

El Plan (`maxBranches`) es tope duro: no se crea una sucursal de más.

#### `GET /api/v1/admin/branches`

```json
{
  "tenantSlug": "don-luigi",
  "maxBranches": 3,
  "branches": [
    {
      "id": "uuid",
      "name": "Casa Matriz",
      "slug": "casa-matriz",
      "operationalStatus": "OPEN"
    }
  ]
}
```

#### `POST /api/v1/admin/branches`

```json
{
  "name": "Norte",
  "slug": "norte",
  "copyCatalogFromBranchId": "uuid-opcional"
}
```

Respuesta `201`: el ítem creado (`id`, `name`, `slug`, `operationalStatus: "OPEN"`). Timezone inicial: `America/Argentina/Buenos_Aires`.

`copyCatalogFromBranchId` es opcional: sucursal del **mismo Tenant** de la que se copian las disponibilidades acotadas (categorías, productos y combos que no están en “todas las sucursales”). Si se omite, se usa la sucursal más antigua. Lo marcado `availableInAllBranches` ya aparece en el local nuevo sin copiar filas. `404 SOURCE_BRANCH_NOT_FOUND` si el id no pertenece a ese Tenant.

| Código | Significado |
|---|---|
| `409 BRANCH_SLUG_TAKEN` | `slug` único dentro del Tenant. |
| `422 BRANCH_LIMIT_REACHED` | El Tenant ya tiene `maxBranches` sucursales. |
| `404 SOURCE_BRANCH_NOT_FOUND` | La sucursal origen del menú no existe en este Tenant. |

#### `PATCH /api/v1/admin/branches/:id`

Renombra. Body: `{ "name"?: string, "slug"?: string }` (hace falta al menos un campo). Auth: igual que el listado. `404 BRANCH_NOT_FOUND` si el id no es de este Tenant. Cambiar el `slug` invalida la URL pública y el QR impreso de ese local.

| Código | Significado |
|---|---|
| `409 BRANCH_SLUG_TAKEN` | El nuevo slug ya está usado en este Tenant. |
| `422 BRANCH_PATCH_EMPTY` | Body sin `name` ni `slug`. |
| `404 BRANCH_NOT_FOUND` | El id no existe en este Tenant. |

No hay DELETE en este corte (un Tenant no puede quedar sin sucursal).

El cliente manda la sucursal activa en **`X-Branch-Id`** en el resto de `/api/v1/admin/**` (Ajustes, media de branding, catálogo). El backend no confía el header a ciegas: tiene que existir en ese `tenantId` y el rol debe cubrirla (`TENANT` o `BRANCH` de esa sucursal). `PLATFORM_ADMIN` impersonando puede cualquier sucursal de ese tenant. Header ausente o inválido: `branchId` nulo en el contexto (Ajustes cae a la sucursal más antigua) o `404 TENANT_OR_BRANCH_NOT_FOUND` si el id no calza. CORS (`PUBLIC_WEB_ORIGIN`) debe permitir `X-Branch-Id` junto a `Authorization` y `X-Tenant-Id`.

### 5.13 Analytics de la carta (`/events` público y `/admin/analytics`)

La carta pública **no tiene ficha de producto**. Solo se registran gestos reales: abrir la carta, tiempo con la pestaña visible, buscar, filtrar, abrir el 3D.

#### `POST /api/v1/menu/public/:tenantSlug/:branchSlug/events`

Público. `204` si el DTO es válido (un duplicado también es `204`: no se filtra al cliente). `tenantId`/`branchId` salen de la ruta. Body:

```json
{ "kind": "scan", "sessionId": "uuid" }
```

`kind`: `scan` | `search` | `filter` | `ar` | `dwell`.

- `search`: `{ query }` (2–80 caracteres).
- `filter`: `{ filterKind: "allergen" | "dietary", tagId }`.
- `ar`: `{ productId }` (debe existir en el Tenant; si no, se descarta en silencio).
- `dwell`: `{ durationMs }` (1 ms–24 h). El servidor guarda el máximo por sesión.

`sessionId` es UUID anónimo **en memoria por carga de página** (F5 o pestaña nueva = visita nueva). Dedup: un `scan` por `sessionId` y sucursal (evita doble POST, no el refresh); search/filter/AR en ventana corta; dwell se actualiza si el nuevo tiempo es mayor.

#### `GET /api/v1/admin/analytics/summary?periodDays=7|30`

Auth: JWT + rol `STAFF` o superior. `@RequireTenantContext()`. Sucursal: `X-Branch-Id` o la más antigua.

Respuesta: `visits`, `stayedCount` (dwell ≥ 30 s), `averageDwellSeconds`, `searches[]`, `allergenFilters[]`, `dietaryFilters[]`, `arViews { total, products[] }`.

### 5.14 Promos y Happy Hour (`/api/v1/admin/engagement`)

CRUD del Panel Admin. Auth: JWT + rol `ADMIN` o superior. `@RequireTenantContext()`. El `tenantId` sale del JWT / `X-Tenant-Id`; no se acepta en el body.

El precio de lista del producto **no cambia**. La oferta se aplica al servir la carta pública (`features-spec.md` §3.3). Un producto puede estar alcanzado por varias ofertas; gana una sola (prioridad → especificidad → recencia). `GET /admin/catalog/products/:id` **no** incluye ofertas: Catalog no importa Engagement. El formulario de producto pide `product-offers` en paralelo.

v1: `availableInAllBranches = true` (sin picker de sucursal). El UI crea targets de **producto y categoría**; `comboIds` existe en el contrato pero el panel no lo expone. Porcentaje en UI (20) → API `discountPercentageBp` (2000). Status de promo en listados: derivado de fechas (`SCHEDULED` / `ACTIVE` / `EXPIRED`); `CANCELLED` no se usa en este corte. Delete = hard delete (targets en cascada). Un Happy Hour sin `priority` en el body arranca en **10**; una Promo sin `priority` arranca en **0**, para que el Happy Hour gane durante su horario si ambas cubren el mismo plato.

`discountType`: `PERCENTAGE` | `FIXED_AMOUNT` | `FIXED_PRICE`. Hay que mandar el campo que corresponde (`discountPercentageBp` 1–10000, `discountAmountCents` ≥ 1, o `fixedPriceCents` ≥ 0). Hace falta al menos un target (`productIds`, `categoryIds` o `comboIds`).

#### `GET /api/v1/admin/engagement/promos`

Lista del tenant, más reciente primero. Respuesta: `{ "items": [ ... ] }`.

```json
{
  "id": "uuid",
  "name": { "es": "20% OFF Pizza Muzzarella" },
  "description": null,
  "discountType": "PERCENTAGE",
  "discountPercentageBp": 2000,
  "discountAmountCents": null,
  "fixedPriceCents": null,
  "startAt": "2026-08-01T00:00:00.000Z",
  "endAt": "2026-12-31T23:59:59.000Z",
  "priority": 0,
  "status": "ACTIVE",
  "productIds": ["uuid-muzzarella"],
  "categoryIds": [],
  "comboIds": []
}
```

#### `GET /api/v1/admin/engagement/promos/:id`

Mismo objeto. `404 PROMO_NOT_FOUND` si el id no es de ese tenant.

#### `POST /api/v1/admin/engagement/promos`

`201`, mismo objeto. Body: `name`, `discountType`, el campo de descuento que corresponda, `startAt` / `endAt` (ISO), `productIds` / `categoryIds` / `comboIds` (arrays; al menos uno no vacío). `description` y `priority` opcionales. `endAt` tiene que ser posterior a `startAt`.

#### `PUT /api/v1/admin/engagement/promos/:id`

Reemplazo completo (mismos campos que el POST). `200`.

#### `DELETE /api/v1/admin/engagement/promos/:id`

`204`. `404 PROMO_NOT_FOUND`.

#### `GET|POST /api/v1/admin/engagement/happy-hours` y `GET|PUT|DELETE .../happy-hours/:id`

Misma forma de descuento y targets. En lugar de fechas: `daysOfWeek` (`MONDAY`…`SUNDAY`, al menos uno), `startMinuteOfDay` / `endMinuteOfDay` (0–1439, zona horaria de la sucursal; puede cruzar medianoche), `enabled` (default `true`). Sin `status` ni `description` en este corte. `404 HAPPY_HOUR_NOT_FOUND`.

#### `GET /api/v1/admin/engagement/product-offers?productId=`

Ofertas que alcanzan ese producto (target directo o por su categoría). `404 PRODUCT_NOT_FOUND` si el id no es del tenant.

```json
{
  "items": [
    {
      "kind": "PROMO",
      "id": "uuid",
      "name": { "es": "20% OFF Pizza Muzzarella" },
      "scope": "PRODUCT",
      "discountType": "PERCENTAGE",
      "originalPrice": 1200000,
      "finalPrice": 960000,
      "currency": "ARS",
      "appliesNow": true,
      "isWinning": true,
      "startAt": "2026-08-01T00:00:00.000Z",
      "endAt": "2026-12-31T23:59:59.000Z",
      "daysOfWeek": null,
      "startMinuteOfDay": null,
      "endMinuteOfDay": null,
      "enabled": null,
      "status": "ACTIVE"
    }
  ]
}
```

`scope`: `PRODUCT` | `CATEGORY` | `COMBO`. `isWinning` es `true` solo si `appliesNow` y esa oferta gana el desempate. Happy Hour usa `daysOfWeek` / minutos / `enabled`; `appliesNow` se evalúa con el timezone de la sucursal activa (`X-Branch-Id`).

| Código | Significado |
|---|---|
| `404 PROMO_NOT_FOUND` | El id no existe en este Tenant. |
| `404 HAPPY_HOUR_NOT_FOUND` | El id no existe en este Tenant. |
| `404 OFFER_TARGET_NOT_FOUND` | Un producto, categoría o combo del body no es de este Tenant. |
| `404 PRODUCT_NOT_FOUND` | `productId` de `product-offers` no es de este Tenant. |
| `400 VALIDATION_ERROR` | Fechas invertidas, descuento incompleto, o sin targets. |

---

## 6. Resumen Consolidado de Endpoints

| Endpoint | Método | Auth | Rate Limit | Idempotente |
|---|---|---|---|---|
| `/api/v1/menu/public/:tenantSlug/:branchSlug` | `GET` | Ninguna | Sí, por IP + sesión + sucursal, diferenciado por Plan | Sí (lectura) |
| `/api/v1/admin/auth/login` | `POST` | Ninguna (endpoint de login); refresh en cookie HttpOnly | Sí, agresivo, con backoff progresivo | No |
| `/api/v1/admin/auth/refresh` | `POST` | Cookie de refresh (sin Bearer) | Sí, estándar administrativo | No |
| `/api/v1/admin/auth/logout` | `POST` | Cookie de refresh (Bearer opcional) | Sí, estándar administrativo | No |
| `/api/v1/admin/auth/change-password` | `POST` | JWT (cualquier rol autenticado) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/products` | `POST` | JWT (Rol `OWNER`/`ADMIN`, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/products` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/catalog/products/:id` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/catalog/products/:id` | `PUT` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/products/:id` | `DELETE` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/tags` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/catalog/categories` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/catalog/categories` | `POST` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/categories/reorder` | `PATCH` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/categories/:id` | `PUT` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/categories/:id` | `DELETE` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/products/:id/media` | `POST` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/products/:id/media` | `DELETE` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (slot vacío → `204`) |
| `/api/v1/admin/catalog/combos` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/catalog/combos` | `POST` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/combos/:id` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/catalog/combos/:id` | `PUT` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/combos/:id/media` | `POST` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/catalog/combos/:id/media` | `DELETE` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (sin foto → `204`) |
| `/api/v1/admin/catalog/combos/:id` | `DELETE` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/settings/branch` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/settings/branch` | `PATCH` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/settings/branch/logo` | `POST` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/settings/branch/logo` | `DELETE` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (slot vacío → `204`) |
| `/api/v1/admin/settings/branch/banner` | `POST` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/settings/branch/banner` | `DELETE` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (slot vacío → `204`) |
| `/api/v1/admin/platform/tenants` | `GET` | JWT (solo `PLATFORM_ADMIN`) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/platform/tenants` | `POST` | JWT (solo `PLATFORM_ADMIN`) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/platform/tenants/:id/status` | `PATCH` | JWT (solo `PLATFORM_ADMIN`) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/platform/tenants/:id/reset-owner-password` | `POST` | JWT (solo `PLATFORM_ADMIN`) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/branches` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/branches` | `POST` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/branches/:id` | `PATCH` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/menu/public/:tenantSlug/:branchSlug/events` | `POST` | Ninguna | Sí, con deduplicación por sesión anónima | No |
| `/api/v1/admin/analytics/summary` | `GET` | JWT (Rol `STAFF` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/engagement/promos` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/engagement/promos` | `POST` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/engagement/promos/:id` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/engagement/promos/:id` | `PUT` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/engagement/promos/:id` | `DELETE` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/engagement/happy-hours` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/engagement/happy-hours` | `POST` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/engagement/happy-hours/:id` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |
| `/api/v1/admin/engagement/happy-hours/:id` | `PUT` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/engagement/happy-hours/:id` | `DELETE` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | No |
| `/api/v1/admin/engagement/product-offers` | `GET` | JWT (Rol `ADMIN` o superior, o `PLATFORM_ADMIN` impersonando) | Sí, estándar de endpoints administrativos | Sí (lectura) |

---

*Fin de `api-contracts.md`. Este documento complementa a `architecture.md`, `domain-modules.md` y `features-spec.md`, y debe mantenerse sincronizado con ellos ante cualquier cambio de modelo de dominio o de reglas de negocio.*
