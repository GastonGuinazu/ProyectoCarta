import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { pickLocalizedText } from '../../../utils/localized-text.utils';
import { formatPriceFromCents } from '../../../utils/price.utils';
import { AdminCatalogApiService } from './admin-catalog-api.service';
import type {
  AdminComboListItem,
  AdminProductAvailability,
} from './admin-catalog.models';

@Component({
  selector: 'app-combo-list',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combo-list.component.html',
})
export class ComboListComponent {
  private readonly catalogApi = inject(AdminCatalogApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly combos = signal<readonly AdminComboListItem[]>([]);
  protected readonly pending = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly pendingDelete = signal<AdminComboListItem | null>(null);
  protected readonly deleting = signal(false);

  private readonly language = computed(
    () => this.authStore.currentUser()?.preferredLanguage ?? 'es',
  );

  constructor() {
    void this.loadCombos();
  }

  protected comboName(combo: AdminComboListItem): string {
    return pickLocalizedText(combo.name, this.language());
  }

  protected itemsLabel(combo: AdminComboListItem): string {
    return combo.items
      .map(
        (item) =>
          `${pickLocalizedText(item.productName, this.language())} ×${item.quantity}`,
      )
      .join(', ');
  }

  protected priceLabel(combo: AdminComboListItem): string {
    return formatPriceFromCents(combo.price, combo.currency);
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

  protected goToNewCombo(): void {
    void this.router.navigateByUrl('/admin/catalog/combos/new');
  }

  protected goToEdit(combo: AdminComboListItem): void {
    void this.router.navigate(['/admin/catalog/combos', combo.id, 'edit']);
  }

  protected askDelete(combo: AdminComboListItem): void {
    this.pendingDelete.set(combo);
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const combo = this.pendingDelete();
    if (!combo) {
      return;
    }
    this.deleting.set(true);
    try {
      await firstValueFrom(this.catalogApi.deleteCombo(combo.id));
      this.combos.update((items) => items.filter((item) => item.id !== combo.id));
      this.pendingDelete.set(null);
    } catch {
      this.loadError.set('No se pudo eliminar el combo. Intentá de nuevo.');
      this.pendingDelete.set(null);
    } finally {
      this.deleting.set(false);
    }
  }

  private async loadCombos(): Promise<void> {
    this.pending.set(true);
    this.loadError.set(null);
    try {
      const response = await firstValueFrom(this.catalogApi.listCombos());
      this.combos.set(response.items);
    } catch {
      this.combos.set([]);
      this.loadError.set('No pudimos cargar los combos. Intentá de nuevo.');
    } finally {
      this.pending.set(false);
    }
  }
}
