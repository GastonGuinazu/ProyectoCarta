import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { MenuAnalyticsService } from '../../core/api/menu-analytics.service';
import { MenuStore } from '../../core/stores/menu.store';
import { TenantStore } from '../../core/stores/tenant.store';
import { contrastColorForHex, FALLBACK_BRAND_COLOR } from '../../utils/brand-color.utils';
import {
  instagramHref,
  instagramLabel,
  telHref,
  whatsappHref,
} from '../../utils/contact-link.utils';
import { CategoryListComponent } from './category-list.component';
import { CategoryNavComponent } from './category-nav.component';
import { ComboCardComponent } from './combo-card.component';
import { DishSearchComponent } from './dish-search.component';
import { FilterBarComponent } from './filter-bar.component';
import { MENU_COMBOS_SECTION_ID, MENU_HAPPY_HOUR_SECTION_ID, MENU_STICKY_SCROLL_GAP_PX } from './menu-section-ids';
import { ProductCardComponent } from './product-card.component';

/**
 * Contenedor principal de la feature (docs/frontend-architecture.md §4.1).
 * Único componente que lee `TenantStore.resolutionStatus()` para decidir
 * entre pantalla de carga, pantalla de error y el menú real.
 *
 * El color de marca se inyecta como `--primary-color` / `--primary-contrast`
 * en el host vía binding de estilo (no `document.documentElement`): Angular
 * lo serializa en el HTML del elemento, compatible con SSR si se activara.
 */
@Component({
  selector: 'app-menu-layout',
  standalone: true,
  imports: [
    NgOptimizedImage,
    CategoryListComponent,
    CategoryNavComponent,
    ComboCardComponent,
    DishSearchComponent,
    FilterBarComponent,
    ProductCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-layout.component.html',
  host: {
    class: 'block min-h-screen',
    '[style.--primary-color]': 'brandColor()',
    '[style.--primary-contrast]': 'brandContrast()',
    '[style.--menu-sticky-offset]': 'stickyOffsetCss()',
  },
})
export class MenuLayoutComponent {
  protected readonly tenantStore = inject(TenantStore);
  private readonly menuStore = inject(MenuStore);
  private readonly analytics = inject(MenuAnalyticsService);
  private readonly stickyChrome =
    viewChild<ElementRef<HTMLElement>>('stickyChrome');

  /**
   * Alto del chrome sticky (chips + búsqueda + filtros) más un respiro.
   * `scroll-mt-36` (9rem) quedaba corto y el salto a categoría tapaba platos.
   */
  private readonly stickyOffsetPx = signal(256);

  protected readonly stickyOffsetCss = computed(
    () => `${this.stickyOffsetPx()}px`,
  );

  constructor() {
    effect(() => {
      const tenant = this.tenantStore.tenant();
      const branch = this.tenantStore.branch();
      if (
        this.tenantStore.resolutionStatus() === 'resolved' &&
        tenant &&
        branch
      ) {
        this.analytics.startVisit();
      }
    });

    afterRenderEffect((onCleanup) => {
      const el = this.stickyChrome()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') {
        return;
      }
      const apply = () => {
        this.stickyOffsetPx.set(
          Math.ceil(el.getBoundingClientRect().height) +
            MENU_STICKY_SCROLL_GAP_PX,
        );
      };
      apply();
      const observer = new ResizeObserver(apply);
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
  }

  protected readonly combosSectionId = MENU_COMBOS_SECTION_ID;
  protected readonly happyHourSectionId = MENU_HAPPY_HOUR_SECTION_ID;
  protected readonly resolutionStatus = this.tenantStore.resolutionStatus;
  protected readonly filteredCombos = this.menuStore.filteredCombos;
  protected readonly happyHourProducts = this.menuStore.filteredHappyHourProducts;

  protected readonly brandColor = computed(
    () => this.tenantStore.tenant()?.primaryColor ?? FALLBACK_BRAND_COLOR,
  );

  protected readonly brandContrast = computed(() => contrastColorForHex(this.brandColor()));

  protected readonly logoUrl = computed(() => this.tenantStore.tenant()?.logoUrl ?? null);

  protected readonly bannerUrl = computed(
    () => this.tenantStore.branch()?.bannerUrl ?? null,
  );

  protected readonly address = computed(
    () => this.tenantStore.branch()?.address ?? null,
  );

  protected readonly phone = computed(() => this.tenantStore.branch()?.phone ?? null);

  protected readonly whatsapp = computed(
    () => this.tenantStore.branch()?.whatsapp ?? null,
  );

  protected readonly instagram = computed(
    () => this.tenantStore.branch()?.instagram ?? null,
  );

  protected readonly hasFooterContact = computed(
    () => Boolean(this.address() || this.phone()),
  );

  protected readonly branchStatusNotice = computed(() => {
    const status = this.tenantStore.branch()?.operationalStatus;
    if (status === 'CLOSED_TEMPORARILY') {
      return {
        title: 'Cerrado temporalmente',
        body: 'Este local no está atendiendo ahora. La carta sigue disponible para que la mires.',
      };
    }
    if (status === 'MAINTENANCE') {
      return {
        title: 'En mantenimiento',
        body: 'Este local está en obras. La carta sigue disponible para que la mires.',
      };
    }
    return null;
  });

  /** Título del header: nombre del Tenant si ya está resuelto, si no el de la Sucursal. */
  protected readonly headerTitle = computed(
    () => this.tenantStore.tenant()?.name ?? this.tenantStore.branch()?.name ?? '',
  );

  protected readonly branchName = computed(() => this.tenantStore.branch()?.name ?? '');

  protected phoneHref(value: string): string {
    return telHref(value);
  }

  protected whatsappLink(value: string): string {
    return whatsappHref(value);
  }

  protected instagramLink(value: string): string {
    return instagramHref(value);
  }

  protected instagramText(value: string): string {
    return instagramLabel(value);
  }

  protected onArOpened(productId: string): void {
    this.analytics.recordArView(productId);
  }

  protected reload(): void {
    window.location.reload();
  }
}
