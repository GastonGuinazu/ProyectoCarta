import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { pickLocalizedText } from '../../../utils/localized-text.utils';
import { AdminEngagementApiService } from './admin-engagement-api.service';
import type { AdminHappyHour, AdminPromo, AdminPromoStatus } from './admin-engagement.models';

@Component({
  selector: 'app-offer-list',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offer-list.component.html',
})
export class OfferListComponent implements OnInit {
  private readonly api = inject(AdminEngagementApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly promos = signal<readonly AdminPromo[]>([]);
  protected readonly happyHours = signal<readonly AdminHappyHour[]>([]);
  protected readonly pending = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly pendingDelete = signal<
    | { readonly kind: 'PROMO'; readonly id: string; readonly name: string }
    | { readonly kind: 'HAPPY_HOUR'; readonly id: string; readonly name: string }
    | null
  >(null);
  protected readonly deleting = signal(false);

  private readonly language = this.authStore.currentUser()?.preferredLanguage ?? 'es';

  ngOnInit(): void {
    void this.load();
  }

  protected promoName(promo: AdminPromo): string {
    return pickLocalizedText(promo.name, this.language);
  }

  protected happyHourName(item: AdminHappyHour): string {
    return pickLocalizedText(item.name, this.language);
  }

  protected statusLabel(status: AdminPromoStatus): string {
    switch (status) {
      case 'ACTIVE':
        return 'Activa';
      case 'SCHEDULED':
        return 'Programada';
      case 'EXPIRED':
        return 'Vencida';
      case 'CANCELLED':
        return 'Cancelada';
    }
  }

  protected discountLabel(
    item: Pick<
      AdminPromo,
      'discountType' | 'discountPercentageBp' | 'discountAmountCents' | 'fixedPriceCents'
    >,
  ): string {
    if (item.discountType === 'PERCENTAGE') {
      return `−${(item.discountPercentageBp ?? 0) / 100} %`;
    }
    if (item.discountType === 'FIXED_AMOUNT') {
      return `−$${(item.discountAmountCents ?? 0) / 100}`;
    }
    return `$${(item.fixedPriceCents ?? 0) / 100}`;
  }

  protected goToEditPromo(promo: AdminPromo): void {
    void this.router.navigate(['/admin/promos', promo.id, 'edit']);
  }

  protected goToEditHappyHour(item: AdminHappyHour): void {
    void this.router.navigate(['/admin/promos/happy-hours', item.id, 'edit']);
  }

  protected askDeletePromo(promo: AdminPromo): void {
    this.pendingDelete.set({
      kind: 'PROMO',
      id: promo.id,
      name: this.promoName(promo),
    });
  }

  protected askDeleteHappyHour(item: AdminHappyHour): void {
    this.pendingDelete.set({
      kind: 'HAPPY_HOUR',
      id: item.id,
      name: this.happyHourName(item),
    });
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const pending = this.pendingDelete();
    if (!pending) {
      return;
    }
    this.deleting.set(true);
    try {
      if (pending.kind === 'PROMO') {
        await firstValueFrom(this.api.deletePromo(pending.id));
      } else {
        await firstValueFrom(this.api.deleteHappyHour(pending.id));
      }
      this.pendingDelete.set(null);
      await this.load();
    } catch (error: unknown) {
      this.loadError.set(this.messageForError(error));
      this.pendingDelete.set(null);
    } finally {
      this.deleting.set(false);
    }
  }

  private async load(): Promise<void> {
    this.pending.set(true);
    this.loadError.set(null);
    try {
      const [promos, happyHours] = await Promise.all([
        firstValueFrom(this.api.listPromos()),
        firstValueFrom(this.api.listHappyHours()),
      ]);
      this.promos.set(promos.items);
      this.happyHours.set(happyHours.items);
    } catch (error: unknown) {
      this.promos.set([]);
      this.happyHours.set([]);
      this.loadError.set(this.messageForError(error));
    } finally {
      this.pending.set(false);
    }
  }

  private messageForError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'No pudimos conectar con el servidor. Intentá de nuevo.';
    }
    return 'No pudimos cargar las promociones. Intentá de nuevo.';
  }
}
