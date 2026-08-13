import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import type { BranchInfo } from '../models/tenant.models';
import type {
  ActivePromotion,
  AllergenTag,
  CategoryNode,
  ComboItemRef,
  ComboSummary,
  DietaryTagInfo,
  MenuSnapshot,
  ProductSummary,
  VariantGroup,
} from '../models/menu.models';
import type {
  ActivePromotionApiModel,
  AllergenTagApiModel,
  CategoryApiModel,
  ComboApiModel,
  ComboItemRefApiModel,
  DietaryTagApiModel,
  ProductApiModel,
  ProductVariantGroupApiModel,
  PublicMenuBranchApiModel,
} from '../models/public-menu-response.model';
import { extractApiErrorCode } from '../../utils/api-error.utils';
import { MenuStore } from '../stores/menu.store';
import { TenantStore } from '../stores/tenant.store';
import { MenuApiService } from './menu-api.service';

interface ResolveRequest {
  readonly tenantSlug: string;
  readonly branchSlug: string;
}

/**
 * Orquesta la resolución de Tenant/Sucursal a partir de los parámetros de URL:
 * llama a `MenuApiService` y reparte el resultado entre `TenantStore` y
 * `MenuStore` (docs/frontend-architecture.md §2.3/§2.4).
 *
 * Manejo de concurrencia: cada llamada a `resolve()` se empuja a un `Subject`
 * interno compuesto con `switchMap`. Si llega un nuevo par de slugs mientras la
 * request anterior sigue en vuelo (ej. el comensal navega a otra Sucursal antes
 * de que responda la primera), esa request anterior se cancela automáticamente
 * y solo la respuesta de la ÚLTIMA solicitud puede llegar a escribir en los
 * Stores. `catchError` vive DENTRO del observable interno (por request): un
 * error ahí nunca debe propagarse al `Subject` externo, o mataría la
 * suscripción para siempre y ningún `resolve()` posterior volvería a
 * funcionar.
 *
 * A propósito NO se aplica `distinctUntilChanged` sobre los slugs: eso
 * silenciaría un "reintentar" manual con el mismo par tenant/sucursal tras un
 * error. El costo aceptado es, como mucho, una request de red redundante ante
 * un doble click sobre el mismo destino.
 */
@Injectable({ providedIn: 'root' })
export class TenantResolverService {
  private readonly menuApiService = inject(MenuApiService);
  private readonly tenantStore = inject(TenantStore);
  private readonly menuStore = inject(MenuStore);

  private readonly resolveRequests$ = new Subject<ResolveRequest>();

  constructor() {
    this.resolveRequests$
      .pipe(
        tap(() => this.tenantStore.setResolving()),
        switchMap((request) => this.fetchAndApply(request)),
      )
      .subscribe();
  }

  /** Dispara la resolución de Tenant/Sucursal para los slugs de la URL actual. */
  resolve(tenantSlug: string, branchSlug: string): void {
    this.resolveRequests$.next({ tenantSlug, branchSlug });
  }

  private fetchAndApply(request: ResolveRequest) {
    return this.menuApiService.fetchPublicMenu(request.tenantSlug, request.branchSlug).pipe(
      tap((response) => {
        this.tenantStore.setResolved({
          tenant: null,
          branch: mapBranch(response.branch),
          features: null,
        });

        // Snapshot construido de una sola vez y aplicado atómicamente vía
        // `applyRevalidatedSnapshot` (en vez de setters sueltos por campo):
        // evita que `MenuStore.filteredCategoriesTree` (computed) se
        // recalcule con categorías nuevas mientras combos/catálogos todavía
        // reflejan la sucursal anterior.
        const snapshot: MenuSnapshot = {
          categoriesTree: mapCategoryTree(response.categories),
          combos: response.combos.map(mapCombo),
          allergenCatalog: response.catalogs.allergens.map(mapAllergenTag),
          dietaryTagCatalog: response.catalogs.dietaryTags.map(mapDietaryTag),
          // El backend todavía no envía `meta.menuVersion` (pendiente de
          // definirse junto con la estrategia de invalidación de caché,
          // docs/frontend-architecture.md §3.3) — no se inventa un valor.
          menuVersion: null,
        };
        this.menuStore.applyRevalidatedSnapshot(snapshot);
      }),
      catchError((error: unknown) => {
        this.handleError(error);
        return of(null);
      }),
    );
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        // Sin conectividad / la request nunca llegó al servidor.
        this.tenantStore.setError();
        this.menuStore.markOffline();
        return;
      }

      const code = extractApiErrorCode(error.error);

      if (error.status === 404 && code === 'TENANT_SUSPENDED') {
        this.tenantStore.setSuspended();
        this.menuStore.markError();
        return;
      }

      if (error.status === 404) {
        // Cubre `TENANT_OR_BRANCH_NOT_FOUND` y cualquier 404 sin `code`
        // reconocido (docs/api-contracts.md §3.7 no distingue si falló el
        // tenant o la sucursal).
        this.tenantStore.setNotFound();
        this.menuStore.markError();
        return;
      }
    }

    // Cualquier otra falla (5xx, timeout, respuesta con forma inesperada).
    this.tenantStore.setError();
    this.menuStore.markError();
  }
}

/**
 * Mappers DTO ("wire", `public-menu-response.model.ts`) -> dominio
 * (`menu.models.ts`/`tenant.models.ts`). Se mantienen como funciones
 * explícitas (aunque hoy sean 1:1 campo a campo) para no acoplar la forma
 * exacta de la respuesta HTTP a la forma que consumen los Stores cuando el
 * contrato evolucione (ej. `meta`, `tenant.branding`).
 */
function mapBranch(branch: PublicMenuBranchApiModel): BranchInfo {
  return {
    id: branch.id,
    slug: branch.slug,
    name: branch.name,
    timezone: branch.timezone,
    address: branch.address,
    phone: branch.phone,
    whatsapp: branch.whatsapp,
    operationalStatus: branch.operationalStatus,
  };
}

function mapCategoryTree(categories: readonly CategoryApiModel[]): readonly CategoryNode[] {
  return categories.map(mapCategory);
}

function mapCategory(category: CategoryApiModel): CategoryNode {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    order: category.order,
    imageUrl: category.imageUrl,
    products: category.products.map(mapProduct),
    children: mapCategoryTree(category.children),
  };
}

function mapProduct(product: ProductApiModel): ProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    basePrice: product.basePrice,
    currency: product.currency,
    availability: product.availability,
    order: product.order,
    // Clon superficial: `product.allergenIds`/`dietaryTagIds` son arrays de
    // primitivos (`string[]`) que llegan por referencia del body parseado por
    // `HttpClient`. Sin este `[...]`, el signal de `MenuStore` terminaría
    // sosteniendo esa misma referencia — el Store deja de ser el único dueño
    // de la estructura. Costo de CPU despreciable (arrays chicos, primitivos).
    allergenIds: [...product.allergenIds],
    dietaryTagIds: [...product.dietaryTagIds],
    images: { ...product.images },
    webAr: { ...product.webAr },
    variantGroups: product.variantGroups.map(mapVariantGroup),
    activePromotion: mapActivePromotion(product.activePromotion),
  };
}

function mapVariantGroup(group: ProductVariantGroupApiModel): VariantGroup {
  return {
    id: group.id,
    name: group.name,
    selectionType: group.selectionType,
    required: group.required,
    options: group.options.map((option) => ({ ...option })),
  };
}

function mapCombo(combo: ComboApiModel): ComboSummary {
  return {
    id: combo.id,
    slug: combo.slug,
    name: combo.name,
    description: combo.description,
    price: combo.price,
    currency: combo.currency,
    imageUrl: combo.imageUrl,
    availability: combo.availability,
    items: combo.items.map(mapComboItemRef),
    activePromotion: mapActivePromotion(combo.activePromotion),
  };
}

function mapComboItemRef(item: ComboItemRefApiModel): ComboItemRef {
  return { productId: item.productId, quantity: item.quantity };
}

/**
 * El backend ya resolvió por completo cuál Promo/Happy Hour gana y el precio
 * final (`docs/api-contracts.md` §3.6): este mapper NO recalcula nada, solo
 * traduce el DTO wire a un objeto de dominio nuevo e inmutable — nunca
 * devuelve la referencia recibida de la respuesta HTTP tal cual, para que
 * `MenuStore` nunca termine sosteniendo en sus signals un objeto cuyo dueño
 * original sea el cuerpo de la response (ver nota de inmutabilidad en el
 * `tap` de `fetchAndApply`).
 */
function mapActivePromotion(promotion: ActivePromotionApiModel | null): ActivePromotion | null {
  if (!promotion) {
    return null;
  }

  return {
    id: promotion.id,
    kind: promotion.kind,
    name: promotion.name,
    badgeLabel: promotion.badgeLabel,
    discountType: promotion.discountType,
    originalPrice: promotion.originalPrice,
    finalPrice: promotion.finalPrice,
  };
}

function mapAllergenTag(allergen: AllergenTagApiModel): AllergenTag {
  return {
    id: allergen.id,
    code: allergen.code,
    name: allergen.name,
    iconUrl: allergen.iconUrl,
  };
}

function mapDietaryTag(dietaryTag: DietaryTagApiModel): DietaryTagInfo {
  return {
    id: dietaryTag.id,
    code: dietaryTag.code,
    name: dietaryTag.name,
    iconUrl: dietaryTag.iconUrl,
  };
}
