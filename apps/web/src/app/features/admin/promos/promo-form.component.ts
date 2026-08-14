import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { extractApiErrorMessage } from '../../../utils/api-error.utils';
import {
  pickLocalizedText,
  upsertLocalizedText,
} from '../../../utils/localized-text.utils';
import { centsToMajorUnits } from '../../../utils/price.utils';
import { AdminCatalogApiService } from '../catalog/admin-catalog-api.service';
import type {
  AdminCategorySummary,
  AdminProductListItem,
} from '../catalog/admin-catalog.models';
import { AdminEngagementApiService } from './admin-engagement-api.service';
import type { AdminDiscountType, AdminPromoWritePayload } from './admin-engagement.models';
import {
  basisPointsToPercent,
  discountFieldsFromForm,
  filterNamedItems,
  findOverlappingOffers,
  toDatetimeLocalValue,
  toIsoFromDatetimeLocal,
  toOfferTargetSource,
  type OfferTargetSource,
} from './offer-form.utils';

@Component({
  selector: 'app-promo-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './promo-form.component.html',
})
export class PromoFormComponent implements OnInit {
  private readonly api = inject(AdminEngagementApiService);
  private readonly catalogApi = inject(AdminCatalogApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  readonly id = input<string | undefined>(undefined);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly products = signal<readonly AdminProductListItem[]>([]);
  protected readonly categories = signal<readonly AdminCategorySummary[]>([]);
  protected readonly selectedProductIds = signal<readonly string[]>([]);
  protected readonly selectedCategoryIds = signal<readonly string[]>([]);
  protected readonly productQuery = signal('');
  protected readonly categoryQuery = signal('');
  protected readonly otherOffers = signal<readonly OfferTargetSource[]>([]);

  protected readonly isEdit = computed(() => Boolean(this.id()));
  protected readonly pageTitle = computed(() =>
    this.isEdit() ? 'Editar promo' : 'Nueva promo',
  );

  protected readonly visibleProducts = computed(() =>
    filterNamedItems(this.products(), this.productQuery(), this.selectedProductIds()),
  );

  protected readonly visibleCategories = computed(() =>
    filterNamedItems(this.categories(), this.categoryQuery(), this.selectedCategoryIds()),
  );

  protected readonly overlappingOffers = computed(() =>
    findOverlappingOffers(
      this.selectedProductIds(),
      this.selectedCategoryIds(),
      this.products(),
      this.otherOffers(),
    ),
  );

  private readonly language = computed(
    () => this.authStore.currentUser()?.preferredLanguage ?? 'es',
  );

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    discountType: this.formBuilder.nonNullable.control<AdminDiscountType>(
      'PERCENTAGE',
      Validators.required,
    ),
    percent: [20, [Validators.required, Validators.min(0.01), Validators.max(100)]],
    amount: [0, [Validators.min(0)]],
    startAt: ['', Validators.required],
    endAt: ['', Validators.required],
  });

  ngOnInit(): void {
    void this.load();
  }

  protected productLabel(product: AdminProductListItem): string {
    return pickLocalizedText(product.name, this.language());
  }

  protected categoryLabel(category: AdminCategorySummary): string {
    return pickLocalizedText(category.name, this.language());
  }

  protected isProductSelected(id: string): boolean {
    return this.selectedProductIds().includes(id);
  }

  protected isCategorySelected(id: string): boolean {
    return this.selectedCategoryIds().includes(id);
  }

  protected toggleProduct(id: string): void {
    this.selectedProductIds.update((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  protected toggleCategory(id: string): void {
    this.selectedCategoryIds.update((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  protected onProductQuery(event: Event): void {
    this.productQuery.set((event.target as HTMLInputElement).value);
  }

  protected onCategoryQuery(event: Event): void {
    this.categoryQuery.set((event.target as HTMLInputElement).value);
  }

  protected overlapName(offer: OfferTargetSource): string {
    return pickLocalizedText(offer.name, this.language());
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (
      this.selectedProductIds().length === 0 &&
      this.selectedCategoryIds().length === 0
    ) {
      this.saveError.set('Elegí al menos un plato o una categoría.');
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    const value = this.form.getRawValue();
    const payload: AdminPromoWritePayload = {
      name: upsertLocalizedText(null, this.language(), value.name),
      discountType: value.discountType,
      ...discountFieldsFromForm(value.discountType, value.percent, value.amount),
      startAt: toIsoFromDatetimeLocal(value.startAt),
      endAt: toIsoFromDatetimeLocal(value.endAt),
      productIds: this.selectedProductIds(),
      categoryIds: this.selectedCategoryIds(),
      comboIds: [],
    };
    try {
      const id = this.id();
      if (id) {
        await firstValueFrom(this.api.updatePromo(id, payload));
      } else {
        await firstValueFrom(this.api.createPromo(payload));
      }
      await this.router.navigateByUrl('/admin/promos');
    } catch (error: unknown) {
      this.saveError.set(this.messageForError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [products, categories, promos, happyHours] = await Promise.all([
        firstValueFrom(this.catalogApi.listProducts()),
        firstValueFrom(this.catalogApi.listCategories()),
        firstValueFrom(this.api.listPromos()),
        firstValueFrom(this.api.listHappyHours()),
      ]);
      this.products.set(products.items);
      this.categories.set(categories.items);
      const currentId = this.id();
      this.otherOffers.set([
        ...promos.items
          .filter((item) => item.id !== currentId)
          .map(toOfferTargetSource),
        ...happyHours.items.map(toOfferTargetSource),
      ]);

      const id = this.id();
      const preselect = this.route.snapshot.queryParamMap.get('productId');
      if (id) {
        const promo = await firstValueFrom(this.api.getPromo(id));
        this.form.patchValue({
          name: pickLocalizedText(promo.name, this.language()),
          discountType: promo.discountType,
          percent: promo.discountPercentageBp
            ? basisPointsToPercent(promo.discountPercentageBp)
            : 20,
          amount:
            promo.discountType === 'PERCENTAGE'
              ? 0
              : centsToMajorUnits(
                  promo.discountAmountCents ?? promo.fixedPriceCents ?? 0,
                ),
          startAt: toDatetimeLocalValue(promo.startAt),
          endAt: toDatetimeLocalValue(promo.endAt),
        });
        this.selectedProductIds.set(promo.productIds);
        this.selectedCategoryIds.set(promo.categoryIds);
      } else if (preselect) {
        this.selectedProductIds.set([preselect]);
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        this.form.patchValue({
          startAt: toDatetimeLocalValue(start.toISOString()),
          endAt: toDatetimeLocalValue(end.toISOString()),
        });
      } else {
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        this.form.patchValue({
          startAt: toDatetimeLocalValue(start.toISOString()),
          endAt: toDatetimeLocalValue(end.toISOString()),
        });
      }
    } catch (error: unknown) {
      this.loadError.set(this.messageForError(error));
    } finally {
      this.loading.set(false);
    }
  }

  private messageForError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      return extractApiErrorMessage(error.error) ?? 'No pudimos guardar la promo.';
    }
    return 'No pudimos guardar la promo.';
  }
}
