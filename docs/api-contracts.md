# Contratos de API (Request/Response Schemas)

> **Documento**: Especificación de Contratos de API
> **Proyecto**: ProyectoCarta — SaaS Multi-Tenant de Menú Digital PWA para Restaurantes
> **Estado**: Fase de Diseño (sin código de implementación — solo contratos JSON)
> **Relacionado con**: `architecture.md`, `domain-modules.md`, `features-spec.md`

---

## 1. Introducción y Alcance

Este documento define el **contrato exacto de request/response** de los tres endpoints más críticos del sistema, como base para la futura implementación en NestJS. No se define aquí ningún detalle de implementación (controllers, DTOs de clase, esquema de Prisma): únicamente la **forma del JSON** que viaja por la red, sus tipos de datos y sus códigos de estado HTTP.

Los tres endpoints cubiertos son:

1. **Menú Público** — `GET /api/v1/menu/public/:tenantSlug/:branchSlug`
2. **Autenticación del Backoffice** — `POST /api/v1/admin/auth/login`
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
| **Autenticación** | Endpoints públicos: sin autenticación. Endpoints `/admin/*`: header `Authorization: Bearer <jwt>` obligatorio (ver `features-spec.md` §7.2). |
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
    "contact": {
      "phone": "+5491122223333",
      "whatsapp": "+5491122223333"
    },
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
              "images": {
                "thumbnailUrl": "https://res.cloudinary.com/proyectocarta/products/cafe-con-leche_thumb.webp",
                "detailUrl": "https://res.cloudinary.com/proyectocarta/products/cafe-con-leche_detail.webp"
              },
              "webAr": {
                "enabled": false,
                "assetUrl": null
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
              "images": {
                "thumbnailUrl": "https://res.cloudinary.com/proyectocarta/products/medialuna_thumb.webp",
                "detailUrl": "https://res.cloudinary.com/proyectocarta/products/medialuna_detail.webp"
              },
              "webAr": {
                "enabled": true,
                "assetUrl": "https://res.cloudinary.com/proyectocarta/products/medialuna_ar.png"
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

Inicio de sesión del Panel Admin para Owners/Admins/Staff (ver `domain-modules.md` §2.2, entidad `Owner/User`). Devuelve el JWT de sesión de aplicación junto con el contexto necesario para que el frontend sepa qué Tenant, Sucursales y Rol(es) tiene disponibles ese usuario, sin necesidad de una segunda llamada.

### 4.2 Autenticación y Autorización

Ninguna previa (es el propio endpoint de login). Debe estar protegido por **rate limiting agresivo** y bloqueo progresivo ante intentos fallidos repetidos, para mitigar ataques de fuerza bruta (`features-spec.md` §7.3).

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

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItMTIzIn0.signature",
  "refreshToken": "8f14e45f-ceea-4d2a-b1f5-222222222222",
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

| Campo | Tipo | Descripción |
|---|---|---|
| `accessToken` | `string` | JWT de corta duración (`expiresIn` segundos) para autorizar cada request administrativa. |
| `refreshToken` | `string` | Token opaco de larga duración para renovar el `accessToken` sin pedir credenciales de nuevo (`features-spec.md` §7.2). |
| `roleAssignments` | `array` | Refleja exactamente el modelo de RBAC de `domain-modules.md` §2.2: un Rol puede ser de alcance `TENANT` (global, ej. Owner) o `BRANCH` (acotado a una sucursal específica, ej. Staff). |
| `accessibleBranches` | `array` | Lista de sucursales visibles para el usuario, pensada para poblar el selector de sucursal del Panel Admin sin llamada adicional. |

### 4.5 Estructura Conceptual del JWT (`accessToken` decodificado)

> Documentado a nivel de **contrato de claims**, no de implementación (ver `features-spec.md` §7.2).

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

### 4.6 Respuestas de Error

| Código HTTP | `error.code` | Cuándo ocurre |
|---|---|---|
| `401` | `INVALID_CREDENTIALS` | Email inexistente o password incorrecta. Mensaje genérico para no revelar cuál de los dos campos falló. |
| `403` | `ACCOUNT_DISABLED` | El usuario existe pero está deshabilitado o es una invitación pendiente de aceptar (`domain-modules.md` §2.2). |
| `403` | `TENANT_SUSPENDED` | El Tenant al que pertenece el usuario está suspendido. |
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
- Requiere Rol `OWNER` o `ADMIN` sobre el Tenant/Sucursal indicada (RBAC, `features-spec.md` §7.2). El Rol `STAFF` no puede crear productos.

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

---

## 6. Resumen Consolidado de Endpoints

| Endpoint | Método | Auth | Rate Limit | Idempotente |
|---|---|---|---|---|
| `/api/v1/menu/public/:tenantSlug/:branchSlug` | `GET` | Ninguna | Sí, por IP + sesión + sucursal, diferenciado por Plan | Sí (lectura) |
| `/api/v1/admin/auth/login` | `POST` | Ninguna (endpoint de login) | Sí, agresivo, con backoff progresivo | No |
| `/api/v1/admin/catalog/products` | `POST` | JWT (Rol `OWNER`/`ADMIN`) | Sí, estándar de endpoints administrativos | No |

---

*Fin de `api-contracts.md`. Este documento complementa a `architecture.md`, `domain-modules.md` y `features-spec.md`, y debe mantenerse sincronizado con ellos ante cualquier cambio de modelo de dominio o de reglas de negocio.*
