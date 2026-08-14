import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import type { AllergenTag, DietaryTagInfo } from '../../core/models/menu.models';
import { MenuAnalyticsService } from '../../core/api/menu-analytics.service';
import { MenuStore } from '../../core/stores/menu.store';
import { pickLocalizedText } from '../../utils/localized-text.utils';

/**
 * Barra de filtros del menú público. Lee los catálogos del `MenuStore` y
 * escribe los sets activos vía toggles del mismo Store: `filteredCategoriesTree`
 * y `filteredCombos` se recalcan solos (docs/frontend-architecture.md §2.8).
 *
 * Semántica de los chips (features-spec.md §5.4):
 * - Alérgenos → exclusión ("Sin Gluten"): oculta productos que contienen el tag.
 * - Dietéticas → inclusión AND ("Vegano"): exige que el producto tenga el tag.
 */
@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-bar.component.html',
})
export class FilterBarComponent {
  private readonly menuStore = inject(MenuStore);
  private readonly analytics = inject(MenuAnalyticsService);

  protected readonly allergenCatalog = this.menuStore.allergenCatalog;
  protected readonly dietaryTagCatalog = this.menuStore.dietaryTagCatalog;
  protected readonly excludedAllergenIds = this.menuStore.excludedAllergenIds;
  protected readonly requiredDietaryTagIds = this.menuStore.requiredDietaryTagIds;
  protected readonly hasActiveFilters = this.menuStore.hasActiveFilters;

  protected readonly hasCatalogs = computed(
    () => this.allergenCatalog().length > 0 || this.dietaryTagCatalog().length > 0,
  );

  protected tagName(tag: AllergenTag | DietaryTagInfo): string {
    return pickLocalizedText(tag.name);
  }

  protected isAllergenActive(allergenId: string): boolean {
    return this.excludedAllergenIds().has(allergenId);
  }

  protected isDietaryActive(tagId: string): boolean {
    return this.requiredDietaryTagIds().has(tagId);
  }

  protected toggleAllergen(allergenId: string): void {
    const wasActive = this.isAllergenActive(allergenId);
    this.menuStore.toggleExcludedAllergen(allergenId);
    if (!wasActive) {
      this.analytics.recordFilter('allergen', allergenId);
    }
  }

  protected toggleDietary(tagId: string): void {
    const wasActive = this.isDietaryActive(tagId);
    this.menuStore.toggleRequiredDietaryTag(tagId);
    if (!wasActive) {
      this.analytics.recordFilter('dietary', tagId);
    }
  }

  protected clearFilters(): void {
    this.menuStore.clearAllFilters();
  }
}
