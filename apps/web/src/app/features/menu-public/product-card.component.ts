import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import type { ProductSummary } from '../../core/models/menu.models';
import { pickLocalizedText } from '../../utils/localized-text.utils';
import { formatPriceFromCents } from '../../utils/price.utils';

/**
 * Presentacional puro (docs/frontend-architecture.md §4.2): solo `input()`,
 * sin `inject()` de ningún Store — reutilizable y testeable de forma
 * aislada. `ChangeDetectionStrategy.OnPush` obligatorio para listas grandes
 * (.cursor/rules/02-frontend-angular.mdc).
 *
 * El badge de WebAR es puramente informativo: la experiencia de "Ver en mi
 * mesa" en sí vive en la feature aislada `features/web-ar/`
 * (docs/frontend-architecture.md §4.3), fuera del alcance de este componente.
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  readonly product = input.required<ProductSummary>();

  protected readonly name = computed(() => pickLocalizedText(this.product().name));
  protected readonly description = computed(() => {
    const description = this.product().description;
    return description ? pickLocalizedText(description) : null;
  });

  protected readonly isAvailable = computed(() => this.product().availability === 'AVAILABLE');
  protected readonly thumbnailUrl = computed(() => this.product().images.thumbnailUrl);

  protected readonly formattedBasePrice = computed(() => {
    const product = this.product();
    return formatPriceFromCents(product.basePrice, product.currency);
  });

  /** `null` si no hay promoción activa: la plantilla muestra el precio base sin tachar. */
  protected readonly formattedOriginalPrice = computed(() => {
    const product = this.product();
    if (!product.activePromotion) {
      return null;
    }
    return formatPriceFromCents(product.activePromotion.originalPrice, product.currency);
  });

  protected readonly formattedFinalPrice = computed(() => {
    const product = this.product();
    if (!product.activePromotion) {
      return null;
    }
    return formatPriceFromCents(product.activePromotion.finalPrice, product.currency);
  });

  protected readonly promotionBadgeLabel = computed(() => {
    const promotion = this.product().activePromotion;
    return promotion ? pickLocalizedText(promotion.badgeLabel) : null;
  });
}
