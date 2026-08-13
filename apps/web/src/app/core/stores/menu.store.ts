import { Injectable, computed, signal } from '@angular/core';
import type {
  AllergenTag,
  CategoryNode,
  ComboSummary,
  DietaryTagInfo,
  MenuSnapshot,
  MenuSyncStatus,
} from '../models/menu.models';
import { countProductsInTree, filterCategoryTreeByExcludedAllergens } from '../../utils/category-tree.utils';

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
   * IDs de alérgenos que el comensal quiere excluir. En la arquitectura destino
   * (docs/frontend-architecture.md §2.5) el dueño de esta preferencia es
   * `PreferencesStore` (persistida en `localStorage`, fuera del alcance de este
   * ticket). Hasta que ese Store exista, `MenuStore` la mantiene internamente y
   * expone `setExcludedAllergenFilters()` para que, cuando se implemente,
   * `PreferencesStore` la sincronice hacia acá.
   */
  private readonly _excludedAllergenIds = signal<ReadonlySet<string>>(new Set());

  readonly categoriesTree = this._categoriesTree.asReadonly();
  readonly combos = this._combos.asReadonly();
  readonly allergenCatalog = this._allergenCatalog.asReadonly();
  readonly dietaryTagCatalog = this._dietaryTagCatalog.asReadonly();
  readonly menuVersion = this._menuVersion.asReadonly();
  readonly syncStatus = this._syncStatus.asReadonly();
  readonly lastSyncedAt = this._lastSyncedAt.asReadonly();
  readonly excludedAllergenIds = this._excludedAllergenIds.asReadonly();

  /**
   * Árbol de categorías con productos filtrados dinámicamente según los
   * alérgenos excluidos activos (docs/frontend-architecture.md §2.8). Se
   * recalcula de forma síncrona e instantánea ante cualquier cambio de
   * `categoriesTree` o del filtro, sin ningún round-trip de red
   * (features-spec.md §5.4).
   */
  readonly filteredCategoriesTree = computed(() =>
    filterCategoryTreeByExcludedAllergens(this._categoriesTree(), this._excludedAllergenIds()),
  );

  /** Total de productos visibles tras aplicar el filtro de alérgenos activo. */
  readonly filteredProductCount = computed(() => countProductsInTree(this.filteredCategoriesTree()));

  /** `true` si el comensal tiene al menos un alérgeno excluido activo. */
  readonly hasActiveAllergenFilter = computed(() => this._excludedAllergenIds().size > 0);

  /** `true` una vez que se hidrató algún dato (desde caché o desde red). */
  readonly hasMenuData = computed(() => this._categoriesTree().length > 0);

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

  clearAllergenFilters(): void {
    this._excludedAllergenIds.set(new Set());
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
  }

  private applySnapshot(snapshot: MenuSnapshot): void {
    this._categoriesTree.set(snapshot.categoriesTree);
    this._combos.set(snapshot.combos);
    this._allergenCatalog.set(snapshot.allergenCatalog);
    this._dietaryTagCatalog.set(snapshot.dietaryTagCatalog);
    this._menuVersion.set(snapshot.menuVersion);
  }
}
