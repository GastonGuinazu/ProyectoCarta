import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import type { ComboSummary } from '../../core/models/menu.models';
import { MenuStore } from '../../core/stores/menu.store';
import { pickLocalizedText } from '../../utils/localized-text.utils';
import { formatPriceFromCents } from '../../utils/price.utils';

/**
 * Card de combo. Recibe el `ComboSummary` por `input()` (misma forma que
 * `ProductCardComponent`) y resuelve los nombres de `combo.items` contra el
 * índice derivado `MenuStore.productsById` — el contrato solo envía
 * `{ productId, quantity }` (docs/api-contracts.md §3.5).
 */
@Component({
  selector: 'app-combo-card',
  standalone: true,
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combo-card.component.html',
})
export class ComboCardComponent {
  private readonly menuStore = inject(MenuStore);

  readonly combo = input.required<ComboSummary>();

  protected readonly name = computed(() => pickLocalizedText(this.combo().name));
  protected readonly description = computed(() => {
    const description = this.combo().description;
    return description ? pickLocalizedText(description) : null;
  });

  protected readonly isAvailable = computed(() => this.combo().availability === 'AVAILABLE');
  protected readonly imageUrl = computed(() => this.combo().imageUrl);

  protected readonly formattedBasePrice = computed(() => {
    const combo = this.combo();
    return formatPriceFromCents(combo.price, combo.currency);
  });

  protected readonly formattedOriginalPrice = computed(() => {
    const combo = this.combo();
    if (!combo.activePromotion) {
      return null;
    }
    return formatPriceFromCents(combo.activePromotion.originalPrice, combo.currency);
  });

  protected readonly formattedFinalPrice = computed(() => {
    const combo = this.combo();
    if (!combo.activePromotion) {
      return null;
    }
    return formatPriceFromCents(combo.activePromotion.finalPrice, combo.currency);
  });

  protected readonly promotionBadgeLabel = computed(() => {
    const promotion = this.combo().activePromotion;
    return promotion ? pickLocalizedText(promotion.badgeLabel) : null;
  });

  protected readonly resolvedItems = computed(() => {
    const productsById = this.menuStore.productsById();
    return this.combo().items.map((item) => {
      const product = productsById.get(item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        name: product ? pickLocalizedText(product.name) : null,
      };
    });
  });
}
