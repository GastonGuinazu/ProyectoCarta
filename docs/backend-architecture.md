# Arquitectura Backend — NestJS (API Multi-Tenant)

> **Documento**: Especificación de Arquitectura Backend
> **Proyecto**: ProyectoCarta — SaaS Multi-Tenant de Menú Digital PWA para Restaurantes
> **Estado**: Fase de Diseño (diseño estructural, sin código de implementación)
> **Relacionado con**: `architecture.md`, `domain-modules.md`, `api-contracts.md`, `.cursor/rules/01-global-architecture.mdc`, `.cursor/rules/03-backend-nestjs.mdc`

---

## 1. Introducción y Alcance

Este documento diseña la **arquitectura interna del backend NestJS** que implementará los contratos de `api-contracts.md` respetando los 5 dominios definidos en `domain-modules.md`. Cubre tres aspectos:

1. **Estructura de Módulos**: mapeo de los dominios a `Module`s de NestJS y sus reglas de comunicación.
2. **Ciclo de vida de la Request**: el pipeline estricto Middleware → Guards → Interceptors → Pipes → Controller → Service → Repository, y el rol del `TenantResolutionGuard`.
3. **Aislamiento Multi-Tenant a nivel de datos**: el mecanismo de Prisma (Extensions/Middleware) que actúa como red de seguridad automática ante un eventual bug de un desarrollador.

No se define aquí ninguna clase, decorador ni firma de método concreta: solo la forma estructural (módulos, capas, pipeline) y los mecanismos conceptuales que la implementación deberá respetar.

---

## 2. Estructura de Módulos (Domain-Driven Design en NestJS)

### 2.1 Principio de Mapeo

Cada uno de los 5 **Bounded Contexts** de `domain-modules.md` se mapea a un `Module` de NestJS de primer nivel. Además, se agregan módulos de infraestructura transversal (no son un dominio de negocio en sí) y un módulo de **composición de lectura** para el menú público, que orquesta varios dominios sin que estos dependan entre sí de forma incorrecta.

| Dominio (`domain-modules.md`) | Módulo NestJS | Responsabilidad |
|---|---|---|
| Tenant | `TenantModule` | Tenants, Sucursales, Usuarios, Roles (RBAC), Planes y sus límites. Es el módulo raíz: ningún otro módulo de dominio puede ser importado por él. |
| — (transversal, datos de Tenant) | `AuthModule` | Login, emisión/validación de JWT, refresh tokens. Depende de `TenantModule` para leer Usuarios/Roles. |
| Catalog | `CatalogModule` | Categorías (jerarquía auto-referencial), Productos, Combos, Variantes. |
| Engagement | `EngagementModule` | Promos y Happy Hours, incluyendo el motor de evaluación de vigencia y resolución de solapamiento (`features-spec.md` §3.2). |
| Media & AR | `MediaModule` | `MediaAsset`, `ProcessedVariant`, integración con Cloudinary y Supabase Storage, orquestación del pipeline de compresión/recorte de fondo con IA. |
| Analytics | `AnalyticsModule` | `ScanEvent`, `InteractionEvent`, `AggregatedMetric`. Dominio de solo consumo/agregación (`domain-modules.md` §6.5). |
| — (composición de lectura) | `PublicMenuModule` | Orquesta `CatalogModule` + `EngagementModule` + `MediaModule` + `TenantModule` para construir el payload único de `GET /api/v1/menu/public/...` (`api-contracts.md` §3). No contiene entidades propias: es una capa de agregación de solo lectura. |
| — (infraestructura) | `PrismaModule` (global) | Expone el cliente Prisma extendido (ver §4) a todos los módulos. |
| — (infraestructura) | `CommonModule` (global) | Guards, Interceptors, Filters, decoradores compartidos (`@CurrentTenant()`, `@CurrentUser()`), configuración validada de variables de entorno. |

### 2.2 Grafo de Dependencias entre Módulos

```mermaid
graph TD
    TN[TenantModule]
    AU[AuthModule] --> TN
    CT[CatalogModule] --> TN
    MD[MediaModule] --> TN
    MD --> CT
    EN[EngagementModule] --> TN
    EN --> CT
    PM[PublicMenuModule] --> TN
    PM --> CT
    PM --> EN
    PM --> MD
    AN[AnalyticsModule] --> TN
    AN --> CT
    AN --> EN
    AN --> MD
```

Este grafo es **idéntico en dirección** al "Mapa de Dependencias Consolidado" de `domain-modules.md` §7: nunca un módulo "de nivel inferior" importa uno "de nivel superior". En particular:

- `TenantModule` **no importa a ningún otro módulo de dominio**: es la raíz.
- `CatalogModule` **no importa `EngagementModule` ni `MediaModule`**, aunque conceptualmente "sepa" que existen assets y promos asociadas a sus entidades — esa composición ocurre en `PublicMenuModule`, nunca dentro de `CatalogModule` mismo.
- `AnalyticsModule` es el único módulo de dominio que puede importar a **todos** los demás (solo para validar pertenencia de las entidades referenciadas por un evento, `features-spec.md` §7.5), pero **ningún módulo importa a `AnalyticsModule`**, preservando su carácter de dominio terminal.

### 2.3 Reglas de Comunicación entre Módulos

1. **Exportación explícita de Services**: un módulo solo expone a sus consumidores los `Service`s listados en su array `exports`; nunca se exportan Repositories directamente (mantiene la capa de Repository como un detalle de implementación interno del módulo dueño del dominio, ver `.cursor/rules/03-backend-nestjs.mdc`).
2. **Prohibición de dependencias circulares**: si dos módulos parecieran necesitar conocerse mutuamente, la señal correcta es que falta un tercer módulo de composición (como `PublicMenuModule`) o que la comunicación debe invertirse mediante eventos (punto siguiente), nunca resolverlo con `forwardRef()` como solución por defecto.
3. **Comunicación inversa vía eventos de dominio**: para los casos donde un módulo "de nivel inferior" necesita notificar algo a uno "de nivel superior" en el grafo (ej. `MediaModule` termina de procesar el recorte de fondo con IA y `CatalogModule` necesita reflejar que el asset AR de un Producto ya está listo), se usa un **Event Emitter interno** (`@nestjs/event-emitter` o equivalente): `MediaModule` emite un evento de dominio (ej. `media-asset.processed`) sin conocer quién lo escucha, y un listener dentro de `CatalogModule` se suscribe a ese evento. Así se evita que `MediaModule` tenga que importar `CatalogModule`, rompiendo lo que de otro modo sería una dependencia circular con `MediaModule → TenantModule/CatalogModule` ya existente en sentido contrario.
4. **`PublicMenuModule` es de solo lectura y no contiene lógica de escritura de negocio**: únicamente combina los resultados de los servicios de lectura de `CatalogModule`, `EngagementModule` y `MediaModule` (equivalente a un *read model* de composición) para armar el JSON del contrato público, sin duplicar reglas de negocio que ya viven en su módulo dueño (ej. la resolución de qué Promo aplica sigue viviendo en `EngagementModule`, `PublicMenuModule` solo la invoca).

---

## 3. Flujo de la Petición (Request Lifecycle)

### 3.1 Pipeline General de NestJS Aplicado a este Proyecto

```mermaid
flowchart TD
    A[Request HTTP entrante] --> B["Middleware Global<br/>(Helmet, CORS dinámico por Tenant, RateLimiterMiddleware)"]
    B --> C["Guards<br/>(orden: ThrottlerGuard → TenantResolutionGuard → JwtAuthGuard → RolesGuard)"]
    C --> D["Interceptors (fase 'antes')<br/>(TenantContextInterceptor, LoggingInterceptor)"]
    D --> E["Pipes<br/>(ValidationPipe global sobre DTOs de entrada)"]
    E --> F[Controller]
    F --> G[Service]
    G --> H["Repository (Prisma extendido, ver Sección 4)"]
    H --> I[(PostgreSQL con RLS)]
    I --> H
    H --> G
    G --> F
    F --> J["Interceptors (fase 'después')<br/>(TransformResponseInterceptor)"]
    J --> K[Response HTTP]
    C -.->|Guard rechaza| L["ExceptionFilter → Envoltorio de error (api-contracts.md §2.1)"]
    E -.->|Validación falla| L
```

### 3.2 Orden Estricto de Guards y su Justificación

| Orden | Guard | Rol |
|---|---|---|
| 1 | `ThrottlerGuard` | Rechaza la request lo antes posible si se superó el rate limit (`features-spec.md` §7.3–7.4), evitando gastar ciclos de cómputo en resolver tenant/JWT para tráfico abusivo. |
| 2 | `TenantResolutionGuard` | Resuelve el contexto de Tenant/Sucursal (ver §3.3). Se ejecuta **antes** de `JwtAuthGuard` porque incluso las rutas públicas (sin JWT) necesitan este contexto. |
| 3 | `JwtAuthGuard` | Solo activo en rutas `/admin/**` (vía decorador de metadata en el Controller/handler). Valida firma y expiración del JWT, puebla `request.user` con los claims (`api-contracts.md` §4.5). |
| 4 | `RolesGuard` | Solo activo en rutas `/admin/**` que declaran un Rol mínimo requerido (decorador `@RequiredRole(...)`). Compara el Rol efectivo del usuario (desde `request.user.roles`) contra el requerido por el endpoint. |

### 3.3 `TenantResolutionGuard` — Diseño Conceptual

Es el guard más crítico de todo el sistema, porque de él depende que el resto del pipeline (Interceptors, Services, Repositories, y la extensión de Prisma de la Sección 4) tenga siempre un `TenantContext` confiable.

**Dos rutas de resolución posibles, unificadas en la misma forma de salida:**

| Origen de la request | Cómo se resuelve el `tenantId`/`branchId` |
|---|---|
| Ruta pública (`/api/v1/menu/public/:tenantSlug/:branchSlug`) | El guard extrae `tenantSlug` y `branchSlug` de los **parámetros de ruta**, consulta (con caché de corta duración) a un `TenantLookupService` expuesto por `TenantModule`, y valida que el Tenant esté `ACTIVE` (no suspendido, `architecture.md` §3) y que la Sucursal exista. |
| Ruta administrativa (`/api/v1/admin/**`) | El guard **no vuelve a resolver desde slugs**: reutiliza el `tenantId` ya presente en los claims del JWT (una vez que `JwtAuthGuard` corrió y pobló `request.user`), evitando una consulta redundante y garantizando que un administrador nunca pueda operar sobre un Tenant distinto al de su propia sesión, aunque manipule parámetros de la URL. |

**Salida del guard**: en ambos casos, el guard construye el mismo objeto conceptual `TenantContext { tenantId, branchId | null }` y lo deja disponible para el resto del ciclo de vida de la request de dos formas complementarias:

1. **Explícita**: adjuntado a `request` (ej. `request.tenantContext`), accesible desde Controllers/Services vía el decorador `@CurrentTenant()` de `CommonModule`.
2. **Implícita (para la capa de datos)**: propagado a un almacenamiento contextual basado en `AsyncLocalStorage` (ver Sección 4), de forma que el mecanismo automático de aislamiento de Prisma pueda leerlo sin que cada Service tenga que pasarlo manualmente en cada llamada interna.

**Fallos de resolución**: si el Tenant/Sucursal no existe o está suspendido, el guard lanza directamente la excepción correspondiente (`TENANT_OR_BRANCH_NOT_FOUND` / `TENANT_SUSPENDED`, ver `api-contracts.md` §3.7), cortando el pipeline antes de llegar a Interceptors/Controller.

### 3.4 Secuencia Comparada: Request Pública vs. Request Administrativa

```mermaid
sequenceDiagram
    participant C1 as Comensal (GET /menu/public/...)
    participant C2 as Admin (POST /admin/catalog/products)
    participant TG as TenantResolutionGuard
    participant JG as JwtAuthGuard
    participant RG as RolesGuard
    participant Ctrl as Controller
    participant Svc as Service
    participant Repo as Repository (Prisma)

    C1->>TG: resuelve tenant/branch por slug de ruta
    TG->>Ctrl: TenantContext adjunto (sin JWT)
    Ctrl->>Svc: obtenerMenuPublico()
    Svc->>Repo: consultas filtradas (tenantId ya en contexto)

    C2->>TG: (placeholder, aún sin JWT decodificado)
    TG->>JG: continúa pipeline
    JG->>JG: valida y decodifica JWT
    JG->>TG: TenantContext derivado de claims del JWT
    TG->>RG: verifica Rol requerido (OWNER/ADMIN)
    RG->>Ctrl: autorizado
    Ctrl->>Svc: crearProducto(dto)
    Svc->>Repo: crea con tenantId del contexto
```

---

## 4. Estrategia de Aislamiento Multi-Tenant a Nivel de Datos (Prisma)

### 4.1 Objetivo

Garantizar que **incluso si un desarrollador olvida filtrar por `tenant_id` en un Service o Repository**, el sistema no exponga ni modifique datos de otro Tenant. Esto se logra agregando una **capa automática a nivel del cliente Prisma**, complementaria (no sustituta) de la regla ya obligatoria en `.cursor/rules/03-backend-nestjs.mdc` de pasar `tenantId` explícitamente a cada método de Repository.

Esto amplía a **tres capas independientes de defensa en profundidad** (la Capa 1 y la Capa 3 ya están descritas en `architecture.md` §3.3; la Capa 2 es el foco de esta sección):

| Capa | Mecanismo | Qué cubre |
|---|---|---|
| 1 — Disciplina de código | `tenantId` explícito y obligatorio en cada método de Repository (`.cursor/rules/03-backend-nestjs.mdc`) | Es la capa "intencional": el desarrollador filtra a propósito. Falla si el desarrollador se olvida. |
| **2 — Prisma Client Extension automática** | Intercepta cada operación de Prisma e inyecta `tenant_id` aunque la Capa 1 haya fallado | Red de seguridad silenciosa a nivel de aplicación, descrita en esta sección. |
| 3 — Row Level Security de PostgreSQL | Políticas de base de datos que rechazan filas de otro `tenant_id` a nivel del motor | Última línea de defensa, incluso ante un bug en las Capas 1 y 2 o una query cruda no controlada. |

### 4.2 Mecanismo: `AsyncLocalStorage` + Prisma Client Extension

**Paso 1 — Propagación del contexto sin pasarlo manualmente por cada capa.**

Inmediatamente después de que `TenantResolutionGuard` resuelve el `TenantContext` (Sección 3.3), un componente temprano del pipeline (un Interceptor global, ejecutado justo después de los Guards) envuelve el resto de la ejecución de esa request dentro de un contexto de `AsyncLocalStorage` (API nativa de Node.js). Esto significa que, sin necesidad de inyectar ni pasar el `tenantId` explícitamente a través de cada llamada intermedia, **cualquier código que se ejecute de forma asíncrona "dentro" de esa request** (Controller → Service → Repository → Prisma) puede leer el `tenantId` activo consultando ese almacenamiento contextual.

**Paso 2 — Extensión de Prisma (`$extends`) con un componente de tipo `query`.**

Se define una extensión de Prisma Client que se aplica **solo sobre los modelos marcados como "tenant-scoped"** (la lista de entidades que en `domain-modules.md` cuelgan directa o indirectamente de un Tenant: `Branch`, `Category`, `Product`, `Combo`, `Variant`, `Promo`, `HappyHour`, `MediaAsset`, `ScanEvent`, `InteractionEvent`, etc. — explícitamente **no** se aplica sobre el propio modelo `Tenant`, ya que resolverlo por `slug` es la única operación legítima que debe poder ocurrir sin un `tenant_id` previo). Esta extensión intercepta cada operación antes de que llegue a la base de datos:

- Para operaciones de **lectura** (`findMany`, `findFirst`, `findUnique`, `count`, `aggregate`): fusiona automáticamente `tenant_id: <tenantId del contexto activo>` dentro de la cláusula `where` recibida, sin importar si el Service que originó la llamada ya lo incluyó o no (si ya estaba incluido, la fusión es idempotente).
- Para operaciones de **escritura** (`create`): si el `data` no incluye `tenant_id`, la extensión lo completa automáticamente con el valor del contexto activo, evitando registros "huérfanos" de tenant por un olvido.
- Para operaciones de **actualización/eliminación** (`update`, `updateMany`, `delete`, `deleteMany`): fusiona el filtro de `tenant_id` en el `where`, garantizando que ninguna mutación pueda alcanzar accidentalmente una fila de otro Tenant, incluso si el `id` provisto por error perteneciera a otro cliente.

**Paso 3 — Comportamiento ante ausencia de contexto (fail-closed, no fail-open).**

Si la extensión detecta que se está ejecutando una operación sobre un modelo "tenant-scoped" **sin** un `TenantContext` activo en el `AsyncLocalStorage` (ej. un job en background mal configurado, o un script de mantenimiento), la operación debe **rechazarse explícitamente** (lanzar una excepción interna) en lugar de ejecutarse sin filtro. Cualquier caso legítimo que necesite operar verdaderamente "a través de todos los tenants" (ej. un proceso de agregación de métricas de plataforma para el equipo interno) debe usar una vía explícitamente distinta y auditada (ej. un cliente Prisma separado sin esta extensión, reservado a procesos internos claramente identificados), nunca un "bypass" implícito o silencioso.

### 4.3 Diagrama Conceptual del Mecanismo

```mermaid
flowchart LR
    G[TenantResolutionGuard<br/>resuelve TenantContext] --> ALS["AsyncLocalStorage.run(tenantContext, ...)"]
    ALS --> SVC[Service de dominio]
    SVC --> REPO["Repository<br/>(pasa tenantId explícito — Capa 1)"]
    REPO --> EXT["Prisma Client Extension<br/>(lee AsyncLocalStorage — Capa 2)"]
    EXT -->|"where.tenant_id fusionado/verificado"| PG[(PostgreSQL)]
    PG --> RLS["Row Level Security<br/>(Capa 3)"]
```

### 4.4 Por qué esto Cumple el Objetivo de Negocio

- **Un bug en un Service** (ej. un desarrollador nuevo que arma un `where` sin `tenant_id` al agregar un endpoint de reporte ad-hoc) **ya no puede filtrar datos entre tenants**, porque la Capa 2 corrige/verifica la consulta antes de que llegue a Postgres, y la Capa 3 la rechazaría de todas formas si algo llegara a fallar en las dos capas anteriores.
- **No reemplaza la disciplina de la Capa 1**: se mantiene la regla de `.cursor/rules/03-backend-nestjs.mdc` de pasar `tenantId` explícito en los Repositories, porque la explicitud en el código sigue siendo la señal más clara para code review y tests; la extensión de Prisma es una **red de seguridad**, no una excusa para relajar esa disciplina.
- **Escalable a un futuro "tenant Enterprise" con base de datos dedicada** (`architecture.md` §3.3, punto 4): si ese caso se materializa, basta con que el `TenantContext` resuelto en el Guard seleccione qué instancia de cliente Prisma extendido usar (misma extensión, distinta conexión), sin rediseñar el mecanismo de aislamiento en sí.

---

## 5. Resumen de Decisiones de esta Fase

| Decisión | Elección |
|---|---|
| Mapeo dominio → módulo | 1 a 1 (`Tenant`, `Catalog`, `Engagement`, `Media`, `Analytics`) + `AuthModule`, `PublicMenuModule`, `PrismaModule`, `CommonModule` como módulos de infraestructura/composición |
| Comunicación entre módulos | Services exportados explícitamente + Event Emitter para notificaciones en sentido inverso; sin `forwardRef()` como solución de dependencias circulares |
| Orden de Guards | `ThrottlerGuard` → `TenantResolutionGuard` → `JwtAuthGuard` → `RolesGuard` |
| Resolución de tenant | Por slug de ruta (público) o por claims de JWT (admin), unificadas en el mismo `TenantContext` |
| Aislamiento de datos | 3 capas: `tenantId` explícito en Repository, Prisma Client Extension automática vía `AsyncLocalStorage`, Row Level Security de PostgreSQL |
| Comportamiento ante contexto ausente | *Fail-closed*: se rechaza la operación, nunca se ejecuta sin filtro por omisión |

---

*Fin de `backend-architecture.md`. Este documento se apoya en `domain-modules.md` para los dominios, en `api-contracts.md` para las formas de datos expuestas, y en `.cursor/rules/03-backend-nestjs.mdc` para las restricciones tecnológicas obligatorias del stack NestJS.*
