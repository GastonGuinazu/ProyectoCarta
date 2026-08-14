import { Injectable, computed, signal } from '@angular/core';
import type {
  AllergenTag,
  CategoryNode,
  ComboSummary,
  DietaryTagInfo,
  MenuSnapshot,
  MenuSyncStatus,
} from '../models/menu.models';
import {
  collectHappyHourProducts,
  countProductsInTree,
  filterCategoryTreeBySearch,
  filterCategoryTreeByVisibilityFilters,
  filterCombosBySearch,
  filterCombosByVisibilityFilters,
  indexProductsById,
} from '../../utils/category-tree.utils';

/**
 * Mantiene la última versión conocida del menú, servida desde red o desde
 * `IndexedDB` (docs/frontend-architecture.md §2.4). No expone signals separados
 * por producto individual: los productos viven embebidos en `categoriesTree`,
 * igual que en el contrato de API (fuente única de verdad).
 *
 * Ningún componente escribe directamente sobre estos signals: siempre a través
 * de los métodos públicos de este Store, típicamente invocados desde un futuro
 * `MenuSyncService` (core/services, no forma parte de este ticket).
 */
@Injectable({ providedIn: 'root' })
export class MenuStore {
  private readonly _categoriesTree = signal<readonly CategoryNode[]>([]);
  private readonly _combos = signal<readonly ComboSummary[]>([]);
  private readonly _allergenCatalog = signal<readonly AllergenTag[]>([]);
  private readonly _dietaryTagCatalog = signal<readonly DietaryTagInfo[]>([]);
  private readonly _menuVersion = signal<string | null>(null);
  private readonly _syncStatus = signal<MenuSyncStatus>('hydratingFromCache');
  private readonly _lastSyncedAt = signal<Date | null>(null);

  /**
   * IDs de alérgenos que el comensal quiere excluir, y tags dietéticos que
   * quiere exigir (AND). En la arquitectura destino (docs/frontend-architecture.md
   * §2.5) el dueño de estas preferencias es `PreferencesStore` (persistida en
   * `localStorage`). Hasta que ese Store exista, `MenuStore` las mantiene
   * internamente y expone setters/toggles para que `PreferencesStore` las
   * sincronice hacia acá.
   */
  private readonly _excludedAllergenIds = signal<ReadonlySet<string>>(new Set());
  private readonly _requiredDietaryTagIds = signal<ReadonlySet<string>>(new Set());
  /** Texto del buscador de platos (nombre o descripción). No se persiste. */
  private readonly _searchQuery = signal('');

  readonly categoriesTree = this._categoriesTree.asReadonly();
  readonly combos = this._combos.asReadonly();
  readonly allergenCatalog = this._allergenCatalog.asReadonly();
  readonly dietaryTagCatalog = this._dietaryTagCatalog.asReadonly();
  readonly menuVersion = this._menuVersion.asReadonly();
  readonly syncStatus = this._syncStatus.asReadonly();
  readonly lastSyncedAt = this._lastSyncedAt.asReadonly();
  readonly excludedAllergenIds = this._excludedAllergenIds.asReadonly();
  readonly requiredDietaryTagIds = this._requiredDietaryTagIds.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();

  /**
   * Índice derivado del árbol (no es una segunda fuente de verdad). Sirve para
   * resolver `combo.items[].productId` y para filtrar combos.
   */
  readonly productsById = computed(() => indexProductsById(this._categoriesTree()));

  /**
   * Árbol de categorías con productos filtrados dinámicamente según alérgenos
   * excluidos, tags dietéticos requeridos y el buscador de platos
   * (docs/frontend-architecture.md §2.8). Se recalcula de forma síncrona e
   * instantánea, sin round-trip de red (features-spec.md §5.4).
   */
  readonly filteredCategoriesTree = computed(() => {
    const visible = filterCategoryTreeByVisibilityFilters(
      this._categoriesTree(),
      this._excludedAllergenIds(),
      this._requiredDietaryTagIds(),
    );
    return filterCategoryTreeBySearch(visible, this._searchQuery());
  });

  /**
   * Platos con Happy Hour vigente (oferta ganadora), ya filtrados por
   * alérgenos/dieta/búsqueda. Van al tope de la carta pública.
   */
  readonly filteredHappyHourProducts = computed(() =>
    collectHappyHourProducts(this.filteredCategoriesTree()),
  );

  /** Combos cuyos items cumplen los mismos filtros de visibilidad y búsqueda. */
  readonly filteredCombos = computed(() => {
    const visible = filterCombosByVisibilityFilters(
      this._combos(),
      this.productsById(),
      this._excludedAllergenIds(),
      this._requiredDietaryTagIds(),
    );
    return filterCombosBySearch(visible, this._searchQuery());
  });

  /** Total de productos visibles tras aplicar los filtros activos. */
  readonly filteredProductCount = computed(() => countProductsInTree(this.filteredCategoriesTree()));

  /** `true` si el comensal tiene al menos un alérgeno excluido activo. */
  readonly hasActiveAllergenFilter = computed(() => this._excludedAllergenIds().size > 0);

  /** `true` si el comensal exige al menos un tag dietético. */
  readonly hasActiveDietaryFilter = computed(() => this._requiredDietaryTagIds().size > 0);

  /** `true` si hay alérgenos excluidos o tags dietéticos requeridos (botón "Limpiar"). */
  readonly hasActiveFilters = computed(
    () => this.hasActiveAllergenFilter() || this.hasActiveDietaryFilter(),
  );

  readonly hasActiveSearch = computed(() => this._searchQuery().trim().length > 0);

  /** `true` una vez que se hidrató algún dato (desde caché o desde red). */
  readonly hasMenuData = computed(() => this._categoriesTree().length > 0 || this._combos().length > 0);

  /** Hidratación inicial desde `IndexedDB` (Paso 1, offline-safe, §3.3). */
  hydrateFromCache(snapshot: MenuSnapshot): void {
    this.applySnapshot(snapshot);
    this._syncStatus.set('hydratingFromCache');
  }

  /** Snapshot fresco confirmado por el backend tras revalidar (Paso 2, §3.3). */
  applyRevalidatedSnapshot(snapshot: MenuSnapshot): void {
    this.applySnapshot(snapshot);
    this._syncStatus.set('synced');
    this._lastSyncedAt.set(new Date());
  }

  markRevalidating(): void {
    this._syncStatus.set('revalidating');
  }

  markOffline(): void {
    this._syncStatus.set('offline');
  }

  markError(): void {
    this._syncStatus.set('error');
  }

  setExcludedAllergenFilters(allergenIds: ReadonlySet<string>): void {
    this._excludedAllergenIds.set(new Set(allergenIds));
  }

  setRequiredDietaryFilters(tagIds: ReadonlySet<string>): void {
    this._requiredDietaryTagIds.set(new Set(tagIds));
  }

  toggleExcludedAllergen(allergenId: string): void {
    const next = new Set(this._excludedAllergenIds());
    if (next.has(allergenId)) {
      next.delete(allergenId);
    } else {
      next.add(allergenId);
    }
    this._excludedAllergenIds.set(next);
  }

  toggleRequiredDietaryTag(tagId: string): void {
    const next = new Set(this._requiredDietaryTagIds());
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    this._requiredDietaryTagIds.set(next);
  }

  clearAllergenFilters(): void {
    this._excludedAllergenIds.set(new Set());
  }

  clearDietaryFilters(): void {
    this._requiredDietaryTagIds.set(new Set());
  }

  clearAllFilters(): void {
    this._excludedAllergenIds.set(new Set());
    this._requiredDietaryTagIds.set(new Set());
  }

  setSearchQuery(query: string): void {
    this._searchQuery.set(query);
  }

  clearSearchQuery(): void {
    this._searchQuery.set('');
  }

  /** Descarta el menú actual (ej. el comensal cambió de Sucursal, ver `TenantStore`). */
  reset(): void {
    this._categoriesTree.set([]);
    this._combos.set([]);
    this._allergenCatalog.set([]);
    this._dietaryTagCatalog.set([]);
    this._menuVersion.set(null);
    this._syncStatus.set('hydratingFromCache');
    this._lastSyncedAt.set(null);
    this._excludedAllergenIds.set(new Set());
    this._requiredDietaryTagIds.set(new Set());
    this._searchQuery.set('');
  }

  private applySnapshot(snapshot: MenuSnapshot): void {
    this._categoriesTree.set(snapshot.categoriesTree);
    this._combos.set(snapshot.combos);
    this._allergenCatalog.set(snapshot.allergenCatalog);
    this._dietaryTagCatalog.set(snapshot.dietaryTagCatalog);
    this._menuVersion.set(snapshot.menuVersion);
  }
}
