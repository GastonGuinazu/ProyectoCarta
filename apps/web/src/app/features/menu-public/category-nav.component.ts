import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import type { CategoryNode } from '../../core/models/menu.models';
import { MenuStore } from '../../core/stores/menu.store';
import { pickLocalizedText } from '../../utils/localized-text.utils';
import {
  MENU_COMBOS_SECTION_ID,
  MENU_HAPPY_HOUR_SECTION_ID,
  MENU_STICKY_SCROLL_GAP_PX,
  menuCategorySectionId,
} from './menu-section-ids';

/**
 * Chips horizontales de categorías (y Combos). El click hace smooth scroll
 * a la sección, descontando el alto del chrome sticky para no tapar el título
 * ni los primeros platos. `document.getElementById` solo corre en el handler
 * de click (nunca en constructor), así que no toca el DOM durante un eventual SSR.
 */
@Component({
  selector: 'app-category-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-nav.component.html',
})
export class CategoryNavComponent {
  private readonly document = inject(DOCUMENT);
  private readonly menuStore = inject(MenuStore);

  protected readonly activeSectionId = signal<string | null>(null);

  protected readonly combosSectionId = MENU_COMBOS_SECTION_ID;
  protected readonly happyHourSectionId = MENU_HAPPY_HOUR_SECTION_ID;

  protected readonly hasCombos = computed(() => this.menuStore.filteredCombos().length > 0);
  protected readonly hasHappyHour = computed(
    () => this.menuStore.filteredHappyHourProducts().length > 0,
  );

  protected readonly categories = computed(() => this.menuStore.filteredCategoriesTree());

  protected readonly isVisible = computed(
    () => this.navItemCount() > 1,
  );

  private readonly navItemCount = computed(
    () =>
      this.categories().length +
      (this.hasHappyHour() ? 1 : 0) +
      (this.hasCombos() ? 1 : 0),
  );

  protected categoryName(category: CategoryNode): string {
    return pickLocalizedText(category.name);
  }

  protected sectionId(categoryId: string): string {
    return menuCategorySectionId(categoryId);
  }

  protected isActive(sectionId: string): boolean {
    return this.activeSectionId() === sectionId;
  }

  protected scrollToSection(sectionId: string): void {
    this.activeSectionId.set(sectionId);
    const target = this.document.getElementById(sectionId);
    if (!target) {
      return;
    }

    const sticky = this.document.querySelector('[data-menu-sticky]');
    const stickyHeight =
      sticky instanceof HTMLElement ? sticky.getBoundingClientRect().height : 0;
    const view = this.document.defaultView;
    if (!view) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const top =
      view.scrollY +
      target.getBoundingClientRect().top -
      stickyHeight -
      MENU_STICKY_SCROLL_GAP_PX;
    view.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }
}
