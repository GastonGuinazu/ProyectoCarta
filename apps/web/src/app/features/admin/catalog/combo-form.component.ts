import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../../utils/api-error.utils';
import {
  pickLocalizedText,
  upsertLocalizedText,
} from '../../../utils/localized-text.utils';
import {
  IMAGE_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_HINT,
  IMAGE_UPLOAD_TYPE_ERROR,
  isAcceptedImageFile,
} from '../../../utils/image-upload.utils';
import {
  centsToMajorUnits,
  formatPriceFromCents,
  majorUnitsToCents,
} from '../../../utils/price.utils';
import { AdminCatalogApiService } from './admin-catalog-api.service';
import type {
  AdminComboDetail,
  AdminProductAvailability,
  AdminProductListItem,
} from './admin-catalog.models';

@Component({
  selector: 'app-combo-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combo-form.component.html',
})
export class ComboFormComponent implements OnInit, OnDestroy {
  private readonly catalogApi = inject(AdminCatalogApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly id = input<string | undefined>(undefined);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly removingImage = signal(false);
  protected readonly imagePreview = signal<string | null>(null);
  protected readonly pendingRemoveImage = signal(false);
  protected readonly products = signal<readonly AdminProductListItem[]>([]);
  private readonly formTick = signal(0);

  protected readonly isEdit = computed(() => Boolean(this.id()));
  protected readonly imageUploadAccept = IMAGE_UPLOAD_ACCEPT;
  protected readonly imageUploadHint = IMAGE_UPLOAD_HINT;
  protected readonly pendingImage = signal<File | null>(null);
  private pendingImageUrl: string | null = null;
  protected readonly canUpload = computed(
    () => !this.uploading() && !this.removingImage() && !this.loading(),
  );
  protected readonly pageTitle = computed(() =>
    this.isEdit() ? 'Editar combo' : 'Nuevo combo',
  );
  protected readonly submitLabel = computed(() =>
    this.saving() ? 'Guardando…' : this.isEdit() ? 'Guardar cambios' : 'Crear combo',
  );

  protected readonly availabilityOptions: readonly {
    readonly value: AdminProductAvailability;
    readonly label: string;
  }[] = [
    { value: 'AVAILABLE', label: 'Activo' },
    { value: 'OUT_OF_STOCK', label: 'Agotado' },
    { value: 'DISCONTINUED', label: 'Discontinuado' },
  ];

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(2000)]],
    price: [0, [Validators.required, Validators.min(0)]],
    availability: this.formBuilder.nonNullable.control<AdminProductAvailability>(
      'AVAILABLE',
      Validators.required,
    ),
    items: this.formBuilder.array([this.createItemGroup(), this.createItemGroup()]),
  });

  private existingCombo: AdminComboDetail | null = null;

  private readonly language = computed(
    () => this.authStore.currentUser()?.preferredLanguage ?? 'es',
  );

  protected readonly itemsSumCents = computed(() => {
    this.formTick();
    const productsById = new Map(
      this.products().map((product) => [product.id, product]),
    );
    return this.items.controls.reduce((sum, group) => {
      const product = productsById.get(group.controls.productId.value);
      const quantity = Number(group.controls.quantity.value) || 0;
      return sum + (product?.basePrice ?? 0) * quantity;
    }, 0);
  });

  protected readonly comboPriceCents = computed(() => {
    this.formTick();
    return majorUnitsToCents(Number(this.form.controls.price.value) || 0);
  });

  protected readonly savingsCents = computed(
    () => this.itemsSumCents() - this.comboPriceCents(),
  );

  protected readonly pricingHint = computed(() => {
    const currency = this.products()[0]?.currency ?? 'ARS';
    const itemsSum = formatPriceFromCents(this.itemsSumCents(), currency);
    const comboPrice = formatPriceFromCents(this.comboPriceCents(), currency);
    const savings = this.savingsCents();
    if (savings > 0) {
      return `Suma de items: ${itemsSum} — Precio del combo: ${comboPrice} — Ahorro: ${formatPriceFromCents(savings, currency)}.`;
    }
    if (savings < 0) {
      return `Suma de items: ${itemsSum} — Precio del combo: ${comboPrice}. El combo queda más caro que comprar por separado.`;
    }
    return `Suma de items: ${itemsSum} — Precio del combo: ${comboPrice}.`;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formTick.update((value) => value + 1);
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    this.revokePendingUrl();
  }

  protected get items(): FormArray<ItemGroup> {
    return this.form.controls.items;
  }

  protected productLabel(product: AdminProductListItem): string {
    return pickLocalizedText(product.name, this.language());
  }

  protected productsForRow(index: number): readonly AdminProductListItem[] {
    this.formTick();
    const selected = new Set(
      this.items.controls
        .map((group, groupIndex) =>
          groupIndex === index ? '' : group.controls.productId.value,
        )
        .filter((id) => id.length > 0),
    );
    return this.products().filter((product) => !selected.has(product.id));
  }

  protected addItem(): void {
    this.items.push(this.createItemGroup());
  }

  protected removeItem(index: number): void {
    if (this.items.length <= 2) {
      return;
    }
    this.items.removeAt(index);
  }

  protected onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (file) {
      void this.uploadImage(file);
    }
  }

  protected askRemoveImage(): void {
    if (!this.canUpload()) {
      return;
    }
    this.pendingRemoveImage.set(true);
  }

  protected cancelRemoveImage(): void {
    if (this.removingImage()) {
      return;
    }
    this.pendingRemoveImage.set(false);
  }

  protected async confirmRemoveImage(): Promise<void> {
    const comboId = this.id();
    if (!comboId) {
      this.clearPendingImage();
      this.pendingRemoveImage.set(false);
      return;
    }
    this.removingImage.set(true);
    this.uploadError.set(null);
    try {
      await firstValueFrom(this.catalogApi.deleteComboMedia(comboId));
      this.imagePreview.set(null);
      this.pendingRemoveImage.set(false);
    } catch {
      this.uploadError.set('No pudimos quitar la foto. Intentá de nuevo.');
      this.pendingRemoveImage.set(false);
    } finally {
      this.removingImage.set(false);
    }
  }

  private async uploadImage(file: File): Promise<void> {
    if (this.uploading()) {
      return;
    }
    if (!isAcceptedImageFile(file)) {
      this.uploadError.set(IMAGE_UPLOAD_TYPE_ERROR);
      return;
    }

    const comboId = this.id();
    if (!comboId) {
      this.stagePendingImage(file);
      return;
    }

    const error = await this.sendUpload(comboId, file);
    if (error) {
      this.uploadError.set(error);
    }
  }

  private stagePendingImage(file: File): void {
    const url = URL.createObjectURL(file);
    this.uploadError.set(null);
    this.revokePendingUrl();
    this.pendingImageUrl = url;
    this.pendingImage.set(file);
    this.imagePreview.set(url);
  }

  private clearPendingImage(): void {
    this.revokePendingUrl();
    this.pendingImage.set(null);
    this.imagePreview.set(null);
  }

  private revokePendingUrl(): void {
    if (this.pendingImageUrl) {
      URL.revokeObjectURL(this.pendingImageUrl);
      this.pendingImageUrl = null;
    }
  }

  private async flushPendingUpload(comboId: string): Promise<string | null> {
    const pending = this.pendingImage();
    if (!pending) {
      return null;
    }
    const error = await this.sendUpload(comboId, pending);
    if (error) {
      return error;
    }
    this.revokePendingUrl();
    this.pendingImage.set(null);
    return null;
  }

  private async sendUpload(comboId: string, file: File): Promise<string | null> {
    this.uploading.set(true);
    this.uploadError.set(null);
    try {
      const result = await firstValueFrom(
        this.catalogApi.uploadComboMedia(comboId, file),
      );
      this.imagePreview.set(result.publicUrl);
      return null;
    } catch (error: unknown) {
      return this.messageForUploadError(error);
    } finally {
      this.uploading.set(false);
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.items.controls.forEach((group) => group.markAllAsTouched());
      return;
    }

    const payloadItems = this.items.getRawValue().filter((item) => item.productId);
    if (payloadItems.length < 2) {
      this.saveError.set('Un combo debe incluir al menos dos productos distintos.');
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    const value = this.form.getRawValue();
    const language = this.language();
    const description = value.description.trim();
    const firstProduct = this.products().find(
      (product) => product.id === payloadItems[0]?.productId,
    );

    try {
      const body = {
        name: upsertLocalizedText(this.existingCombo?.name, language, value.name),
        ...(description
          ? {
              description: upsertLocalizedText(
                this.existingCombo?.description,
                language,
                description,
              ),
            }
          : {}),
        price: majorUnitsToCents(value.price),
        currency: firstProduct?.currency,
        availability: value.availability,
        items: payloadItems,
      };
      const comboId = this.id();
      if (comboId) {
        await firstValueFrom(this.catalogApi.updateCombo(comboId, body));
      } else {
        const created = await firstValueFrom(this.catalogApi.createCombo(body));
        const uploadError = await this.flushPendingUpload(created.id);
        if (uploadError) {
          this.uploadError.set(uploadError);
          await this.router.navigate(['/admin/catalog/combos', created.id, 'edit']);
          return;
        }
      }
      await this.router.navigateByUrl('/admin/catalog/combos');
    } catch (error: unknown) {
      this.saveError.set(this.messageForSaveError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private createItemGroup(productId = '', quantity = 1): ItemGroup {
    return this.formBuilder.nonNullable.group({
      productId: [productId, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(1)]],
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const comboId = this.id();
      const [productsResponse, combo] = await Promise.all([
        firstValueFrom(this.catalogApi.listProducts()),
        comboId
          ? firstValueFrom(this.catalogApi.getCombo(comboId))
          : Promise.resolve(null),
      ]);
      this.products.set(productsResponse.items);

      if (combo) {
        this.existingCombo = combo;
        this.form.patchValue({
          name: pickLocalizedText(combo.name, this.language()),
          description: combo.description
            ? pickLocalizedText(combo.description, this.language())
            : '',
          price: centsToMajorUnits(combo.price),
          availability: combo.availability,
        });
        this.items.clear();
        for (const item of combo.items) {
          this.items.push(this.createItemGroup(item.productId, item.quantity));
        }
        if (this.items.length < 2) {
          this.items.push(this.createItemGroup());
        }
        this.imagePreview.set(combo.imageUrl);
      }
    } catch (error: unknown) {
      this.loadError.set(this.messageForLoadError(error));
    } finally {
      this.loading.set(false);
    }
  }

  private messageForLoadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      if (code === 'COMBO_NOT_FOUND') {
        return 'El combo no existe en este restaurante.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
    }
    return 'No pudimos cargar el formulario. Intentá de nuevo.';
  }

  private messageForSaveError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      switch (code) {
        case 'PRODUCT_NOT_FOUND':
          return 'Uno de los productos ya no existe en este restaurante.';
        case 'COMBO_NOT_FOUND':
          return 'El combo ya no existe.';
        case 'VALIDATION_ERROR':
          return (
            extractApiErrorMessage(error.error) ??
            'Revisá los datos del formulario. Un combo necesita al menos dos productos.'
          );
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return 'No pudimos guardar el combo. Intentá de nuevo.';
  }

  private messageForUploadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      switch (code) {
        case 'UNSUPPORTED_MEDIA_TYPE':
        case 'MEDIA_SLOT_TYPE_MISMATCH':
          return IMAGE_UPLOAD_TYPE_ERROR;
        case 'MEDIA_FILE_TOO_LARGE':
          return (
            extractApiErrorMessage(error.error) ??
            'El archivo supera el tamaño máximo permitido.'
          );
        case 'STORAGE_QUOTA_EXCEEDED':
          return 'Alcanzaste el límite de almacenamiento de tu plan.';
        case 'STORAGE_NOT_CONFIGURED':
          return 'Falta configurar el almacenamiento de archivos en el servidor.';
        case 'MEDIA_UPLOAD_FAILED':
          return 'No pudimos guardar el archivo. Intentá de nuevo.';
        case 'MISSING_FILE':
          return 'Adjuntá un archivo para subir.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return 'No pudimos subir la foto. Intentá de nuevo.';
  }
}

type ItemGroup = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<number>;
}>;
