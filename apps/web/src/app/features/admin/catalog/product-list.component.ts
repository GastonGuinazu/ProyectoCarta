import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import {
  localizedTextMatches,
  pickLocalizedText,
} from '../../../utils/localized-text.utils';
import { formatPriceFromCents } from '../../../utils/price.utils';
import { AdminCatalogApiService } from './admin-catalog-api.service';
import type {
  AdminProductAvailability,
  AdminProductListItem,
} from './admin-catalog.models';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-list.component.html',
})
export class ProductListComponent {
  private readonly catalogApi = inject(AdminCatalogApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly products = signal<readonly AdminProductListItem[]>([]);
  protected readonly pending = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly categoryId = signal<string | null>(null);

  private readonly language = computed(
    () => this.authStore.currentUser()?.preferredLanguage ?? 'es',
  );

  protected readonly categoryOptions = computed(() => {
    const language = this.language();
    const names = new Map<string, string>();
    for (const product of this.products()) {
      if (!names.has(product.categoryId)) {
        names.set(
          product.categoryId,
          pickLocalizedText(product.categoryName, language),
        );
      }
    }
    return [...names.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  protected readonly filteredProducts = computed(() => {
    const query = this.searchQuery();
    const categoryId = this.categoryId();
    return this.products().filter((product) => {
      if (categoryId && product.categoryId !== categoryId) {
        return false;
      }
      return localizedTextMatches(product.name, query);
    });
  });

  protected readonly hasActiveFilters = computed(
    () => this.searchQuery().trim().length > 0 || this.categoryId() !== null,
  );

  constructor() {
    void this.loadProducts();
  }

  protected productName(product: AdminProductListItem): string {
    return pickLocalizedText(product.name, this.language());
  }

  protected categoryName(product: AdminProductListItem): string {
    return pickLocalizedText(product.categoryName, this.language());
  }

  protected priceLabel(product: AdminProductListItem): string {
    return formatPriceFromCents(product.basePrice, product.currency);
  }

  protected statusLabel(availability: AdminProductAvailability): string {
    switch (availability) {
      case 'AVAILABLE':
        return 'Activo';
      case 'OUT_OF_STOCK':
        return 'Agotado';
      case 'DISCONTINUED':
        return 'Discontinuado';
    }
  }

  protected onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.categoryId.set(value ? value : null);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.categoryId.set(null);
  }

  protected goToNewProduct(): void {
    void this.router.navigateByUrl('/admin/catalog/new');
  }

  protected goToEdit(product: AdminProductListItem): void {
    void this.router.navigate(['/admin/catalog', product.id, 'edit']);
  }

  protected onDelete(product: AdminProductListItem): void {
    console.log('Eliminar producto', product.id);
  }

  private async loadProducts(): Promise<void> {
    this.pending.set(true);
    this.loadError.set(null);
    try {
      const response = await firstValueFrom(this.catalogApi.listProducts());
      this.products.set(response.items);
    } catch {
      this.products.set([]);
      this.loadError.set('No pudimos cargar el catálogo. Intentá de nuevo.');
    } finally {
      this.pending.set(false);
    }
  }
}
