import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MenuAnalyticsService } from '../../core/api/menu-analytics.service';
import { MenuStore } from '../../core/stores/menu.store';

@Component({
  selector: 'app-dish-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dish-search.component.html',
})
export class DishSearchComponent {
  private readonly menuStore = inject(MenuStore);
  private readonly analytics = inject(MenuAnalyticsService);

  protected readonly searchQuery = this.menuStore.searchQuery;
  protected readonly hasActiveSearch = this.menuStore.hasActiveSearch;

  protected onQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.menuStore.setSearchQuery(value);
    this.analytics.recordSearch(value);
  }

  protected clearSearch(): void {
    this.menuStore.clearSearchQuery();
  }
}
