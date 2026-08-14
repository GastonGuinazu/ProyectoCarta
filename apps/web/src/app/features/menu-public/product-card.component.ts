import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  computed,
  input,
  OnDestroy,
  output,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import type { ProductSummary } from '../../core/models/menu.models';
import { pickLocalizedText } from '../../utils/localized-text.utils';
import { formatPriceFromCents } from '../../utils/price.utils';
import { minutesToTime } from '../../utils/time-of-day.utils';
import type { ArViewerModalComponent } from '../web-ar/ar-viewer-modal.component';

/**
 * Presentacional puro (docs/frontend-architecture.md §4.2): solo `input()`,
 * sin `inject()` de ningún Store — reutilizable y testeable de forma
 * aislada. `ChangeDetectionStrategy.OnPush` obligatorio para listas grandes
 * (.cursor/rules/02-frontend-angular.mdc).
 *
 * El visor 3D/AR vive en `features/web-ar/` y se carga con `import()` al
 * tocar el botón, para no meter `@google/model-viewer` en el bundle inicial.
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent implements OnDestroy {
  readonly product = input.required<ProductSummary>();
  readonly arOpened = output<string>();

  private readonly arHost = viewChild('arHost', { read: ViewContainerRef });
  private arModalRef: ComponentRef<ArViewerModalComponent> | null = null;

  protected readonly name = computed(() => pickLocalizedText(this.product().name));
  protected readonly description = computed(() => {
    const description = this.product().description;
    return description ? pickLocalizedText(description) : null;
  });

  protected readonly isAvailable = computed(
    () =>
      this.product().availability === 'AVAILABLE' &&
      !this.product().outsideServingHours,
  );
  protected readonly overlayLabel = computed(() => {
    const product = this.product();
    if (product.availability !== 'AVAILABLE') {
      return 'No disponible';
    }
    if (product.outsideServingHours) {
      return 'Fuera de horario';
    }
    return null;
  });
  protected readonly servingHoursLabel = computed(() => {
    const product = this.product();
    if (
      product.servedStartMinuteOfDay == null ||
      product.servedEndMinuteOfDay == null
    ) {
      return null;
    }
    return `${minutesToTime(product.servedStartMinuteOfDay)} – ${minutesToTime(product.servedEndMinuteOfDay)}`;
  });
  protected readonly thumbnailUrl = computed(
    () => this.product().images.detailUrl ?? this.product().images.thumbnailUrl,
  );
  protected readonly modelUrl = computed(() => this.product().webAr.modelUrl);

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

  ngOnDestroy(): void {
    this.closeArViewer();
  }

  protected async openArViewer(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const src = this.modelUrl();
    const host = this.arHost();
    if (!src || !host || !this.isAvailable()) {
      return;
    }

    this.closeArViewer();
    const { ArViewerModalComponent } = await import('../web-ar/ar-viewer-modal.component');
    this.arModalRef = host.createComponent(ArViewerModalComponent);
    this.arModalRef.setInput('src', src);
    this.arModalRef.setInput('productName', this.name());
    this.arModalRef.setInput('poster', this.thumbnailUrl());
    this.arModalRef.instance.closed.subscribe(() => this.closeArViewer());
    this.arOpened.emit(this.product().id);
  }

  private closeArViewer(): void {
    this.arModalRef?.destroy();
    this.arModalRef = null;
  }
}
