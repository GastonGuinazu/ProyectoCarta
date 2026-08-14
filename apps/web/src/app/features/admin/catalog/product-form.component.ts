import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { filter, firstValueFrom, lastValueFrom, tap } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../../utils/api-error.utils';
import {
  pickLocalizedText,
  upsertLocalizedText,
} from '../../../utils/localized-text.utils';
import { centsToMajorUnits, formatPriceFromCents, majorUnitsToCents } from '../../../utils/price.utils';
import { minutesToTime, timeToMinutes } from '../../../utils/time-of-day.utils';
import { AdminCatalogApiService } from './admin-catalog-api.service';
import type {
  AdminCategorySummary,
  AdminCatalogTag,
  AdminProductAvailability,
  AdminProductDetail,
  AdminProductMediaSlot,
  AdminProductMediaUploadResponse,
  AdminProductWritePayload,
} from './admin-catalog.models';
import { AdminEngagementApiService } from '../promos/admin-engagement-api.service';
import type { AdminProductOffer } from '../promos/admin-engagement.models';

interface ImagePreview {
  readonly url: string;
}

interface ModelPreview {
  readonly url: string;
  readonly fileName?: string;
}

const PRESENTATION_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const IMMERSIVE_EXTENSIONS = new Set(['.glb', '.usdz']);

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements OnInit {
  private readonly catalogApi = inject(AdminCatalogApiService);
  private readonly engagementApi = inject(AdminEngagementApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  /** Parametro de ruta `:id` (ausente en `/admin/catalog/new`). */
  readonly id = input<string | undefined>(undefined);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly uploadProgress = signal(0);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly isDragOver = signal<AdminProductMediaSlot | null>(null);
  protected readonly imagePreview = signal<ImagePreview | null>(null);
  protected readonly modelPreview = signal<ModelPreview | null>(null);
  protected readonly uploadingSlot = signal<AdminProductMediaSlot | null>(null);
  protected readonly removingSlot = signal<AdminProductMediaSlot | null>(null);
  protected readonly pendingRemoveSlot = signal<AdminProductMediaSlot | null>(
    null,
  );
  protected readonly categories = signal<readonly AdminCategorySummary[]>([]);
  protected readonly allergens = signal<readonly AdminCatalogTag[]>([]);
  protected readonly dietaryTags = signal<readonly AdminCatalogTag[]>([]);
  protected readonly selectedAllergenIds = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedDietaryTagIds = signal<ReadonlySet<string>>(new Set());
  protected readonly offers = signal<readonly AdminProductOffer[]>([]);
  protected readonly pendingDeleteOffer = signal<AdminProductOffer | null>(null);
  protected readonly deletingOffer = signal(false);

  protected readonly winningOffer = computed(
    () => this.offers().find((offer) => offer.isWinning) ?? null,
  );

  protected readonly isEdit = computed(() => Boolean(this.id()));
  protected readonly canUpload = computed(
    () =>
      this.isEdit() &&
      !this.uploading() &&
      !this.removingSlot() &&
      !this.loading(),
  );
  protected readonly pageTitle = computed(() =>
    this.isEdit() ? 'Editar producto' : 'Nuevo producto',
  );
  protected readonly submitLabel = computed(() =>
    this.saving() ? 'Guardando…' : this.isEdit() ? 'Guardar cambios' : 'Crear producto',
  );

  protected readonly availabilityOptions: readonly {
    readonly value: AdminProductAvailability;
    readonly label: string;
  }[] = [
    { value: 'AVAILABLE', label: 'Activo' },
    { value: 'OUT_OF_STOCK', label: 'Agotado' },
    { value: 'DISCONTINUED', label: 'Discontinuado' },
  ];

  protected readonly form = this.formBuilder.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(120)]],
      description: ['', [Validators.maxLength(2000)]],
      price: [0, [Validators.required, Validators.min(0)]],
      categoryId: ['', Validators.required],
      availability: this.formBuilder.nonNullable.control<AdminProductAvailability>(
        'AVAILABLE',
        Validators.required,
      ),
      servedStart: [''],
      servedEnd: [''],
    },
    { validators: [servingHoursPairValidator] },
  );

  private existingProduct: AdminProductDetail | null = null;

  private readonly language = computed(
    () => this.authStore.currentUser()?.preferredLanguage ?? 'es',
  );

  ngOnInit(): void {
    void this.load();
  }

  protected categoryLabel(category: AdminCategorySummary): string {
    return pickLocalizedText(category.name, this.language());
  }

  protected tagLabel(tag: AdminCatalogTag): string {
    return pickLocalizedText(tag.name, this.language());
  }

  protected isAllergenSelected(id: string): boolean {
    return this.selectedAllergenIds().has(id);
  }

  protected isDietaryTagSelected(id: string): boolean {
    return this.selectedDietaryTagIds().has(id);
  }

  protected toggleAllergen(id: string): void {
    this.selectedAllergenIds.update((current) => toggleId(current, id));
  }

  protected toggleDietaryTag(id: string): void {
    this.selectedDietaryTagIds.update((current) => toggleId(current, id));
  }

  protected offerName(offer: AdminProductOffer): string {
    return pickLocalizedText(offer.name, this.language());
  }

  protected offerPriceLabel(offer: AdminProductOffer): string {
    return `${formatPriceFromCents(offer.originalPrice, offer.currency)} → ${formatPriceFromCents(offer.finalPrice, offer.currency)}`;
  }

  protected offerScopeLabel(offer: AdminProductOffer): string {
    if (offer.scope === 'CATEGORY') {
      return 'Aplica a toda la categoría';
    }
    if (offer.scope === 'COMBO') {
      return 'Aplica a un combo';
    }
    return 'Aplica a este plato';
  }

  protected offerKindLabel(offer: AdminProductOffer): string {
    return offer.kind === 'PROMO' ? 'Promo' : 'Happy Hour';
  }

  protected offerStateLabel(offer: AdminProductOffer): string {
    if (offer.isWinning) {
      return 'Esta es la que ve el comensal ahora';
    }
    if (offer.appliesNow) {
      return 'Vigente, pero otra oferta gana';
    }
    return 'No aplica ahora';
  }

  protected offerEditLink(offer: AdminProductOffer): string[] {
    return offer.kind === 'PROMO'
      ? ['/admin/promos', offer.id, 'edit']
      : ['/admin/promos/happy-hours', offer.id, 'edit'];
  }

  protected askDeleteOffer(offer: AdminProductOffer): void {
    this.pendingDeleteOffer.set(offer);
  }

  protected cancelDeleteOffer(): void {
    this.pendingDeleteOffer.set(null);
  }

  protected async confirmDeleteOffer(): Promise<void> {
    const offer = this.pendingDeleteOffer();
    const productId = this.id();
    if (!offer || !productId) {
      return;
    }
    this.deletingOffer.set(true);
    try {
      if (offer.kind === 'PROMO') {
        await firstValueFrom(this.engagementApi.deletePromo(offer.id));
      } else {
        await firstValueFrom(this.engagementApi.deleteHappyHour(offer.id));
      }
      this.pendingDeleteOffer.set(null);
      await this.reloadOffers(productId);
    } catch {
      this.saveError.set('No pudimos eliminar la promo. Intentá de nuevo.');
      this.pendingDeleteOffer.set(null);
    } finally {
      this.deletingOffer.set(false);
    }
  }

  protected onDragOver(event: DragEvent, slot: AdminProductMediaSlot): void {
    event.preventDefault();
    if (this.canUpload()) {
      this.isDragOver.set(slot);
    }
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(null);
  }

  protected onDrop(event: DragEvent, slot: AdminProductMediaSlot): void {
    event.preventDefault();
    this.isDragOver.set(null);
    const file = event.dataTransfer?.files.item(0);
    if (file) {
      void this.uploadFile(file, slot);
    }
  }

  protected onFileSelected(event: Event, slot: AdminProductMediaSlot): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.item(0);
    inputEl.value = '';
    if (file) {
      void this.uploadFile(file, slot);
    }
  }

  protected askRemove(slot: AdminProductMediaSlot): void {
    if (!this.canUpload()) {
      return;
    }
    this.pendingRemoveSlot.set(slot);
  }

  protected cancelRemove(): void {
    if (this.removingSlot()) {
      return;
    }
    this.pendingRemoveSlot.set(null);
  }

  protected async confirmRemove(): Promise<void> {
    const slot = this.pendingRemoveSlot();
    const productId = this.id();
    if (!slot || !productId || this.removingSlot()) {
      return;
    }

    this.removingSlot.set(slot);
    this.uploadError.set(null);

    try {
      await firstValueFrom(this.catalogApi.deleteProductMedia(productId, slot));
      if (slot === 'presentation') {
        this.imagePreview.set(null);
      } else {
        this.modelPreview.set(null);
      }
      this.pendingRemoveSlot.set(null);
    } catch (error: unknown) {
      this.uploadError.set(this.messageForRemoveError(error));
      this.pendingRemoveSlot.set(null);
    } finally {
      this.removingSlot.set(null);
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.saving() || this.loading()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    try {
      const payload = this.toWritePayload();
      const productId = this.id();
      if (productId) {
        await firstValueFrom(this.catalogApi.updateProduct(productId, payload));
      } else {
        await firstValueFrom(this.catalogApi.createProduct(payload));
      }
      await this.router.navigateByUrl('/admin/catalog');
    } catch (error: unknown) {
      this.saveError.set(this.messageForSaveError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async uploadFile(
    file: File,
    slot: AdminProductMediaSlot,
  ): Promise<void> {
    const productId = this.id();
    if (!productId || this.uploading()) {
      return;
    }

    if (!this.fileMatchesSlot(file, slot)) {
      this.uploadError.set(
        slot === 'presentation'
          ? 'La imagen de presentación solo acepta .jpg, .png o .webp.'
          : 'La experiencia inmersiva solo acepta modelos .glb o .usdz.',
      );
      return;
    }

    this.uploading.set(true);
    this.uploadingSlot.set(slot);
    this.uploadProgress.set(0);
    this.uploadError.set(null);

    try {
      const response = await lastValueFrom(
        this.catalogApi.uploadProductMedia(productId, file, slot).pipe(
          tap((event) => {
            if (
              event.type === HttpEventType.UploadProgress &&
              event.total &&
              event.total > 0
            ) {
              this.uploadProgress.set(
                Math.round((100 * event.loaded) / event.total),
              );
            }
          }),
          filter(
            (event): event is HttpResponse<AdminProductMediaUploadResponse> =>
              event.type === HttpEventType.Response,
          ),
        ),
      );
      const body = response.body;
      if (body && slot === 'presentation') {
        this.imagePreview.set({ url: body.publicUrl });
      } else if (body && slot === 'immersive') {
        this.modelPreview.set({ url: body.publicUrl, fileName: body.fileName });
      }
    } catch (error: unknown) {
      this.uploadError.set(this.messageForUploadError(error));
    } finally {
      this.uploading.set(false);
      this.uploadingSlot.set(null);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const productId = this.id();
      const [categoriesResponse, tagsResponse, product] = await Promise.all([
        firstValueFrom(this.catalogApi.listCategories()),
        firstValueFrom(this.catalogApi.listTags()),
        productId
          ? firstValueFrom(this.catalogApi.getProduct(productId))
          : Promise.resolve(null),
      ]);

      this.categories.set(categoriesResponse.items);
      this.allergens.set(tagsResponse.allergens);
      this.dietaryTags.set(tagsResponse.dietaryTags);

      if (product) {
        this.existingProduct = product;
        this.form.patchValue({
          name: pickLocalizedText(product.name, this.language()),
          description: product.description
            ? pickLocalizedText(product.description, this.language())
            : '',
          price: centsToMajorUnits(product.basePrice),
          categoryId: product.categoryId,
          availability: product.availability,
          servedStart:
            product.servedStartMinuteOfDay != null
              ? minutesToTime(product.servedStartMinuteOfDay)
              : '',
          servedEnd:
            product.servedEndMinuteOfDay != null
              ? minutesToTime(product.servedEndMinuteOfDay)
              : '',
        });
        this.selectedAllergenIds.set(new Set(product.allergenIds ?? []));
        this.selectedDietaryTagIds.set(new Set(product.dietaryTagIds ?? []));
        if (product.media?.primaryUrl && product.media.primaryFileType === 'IMAGE') {
          this.imagePreview.set({ url: product.media.primaryUrl });
        }
        if (product.media?.arModel?.url) {
          this.modelPreview.set({ url: product.media.arModel.url });
        }
        await this.reloadOffers(product.id);
      }
    } catch (error: unknown) {
      this.loadError.set(this.messageForLoadError(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async reloadOffers(productId: string): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.engagementApi.listProductOffers(productId),
      );
      this.offers.set(result.items);
    } catch {
      this.offers.set([]);
    }
  }

  private fileMatchesSlot(file: File, slot: AdminProductMediaSlot): boolean {
    const name = file.name.toLowerCase();
    const lastDot = name.lastIndexOf('.');
    const extension = lastDot >= 0 ? name.slice(lastDot) : '';
    const allowed =
      slot === 'presentation' ? PRESENTATION_EXTENSIONS : IMMERSIVE_EXTENSIONS;
    return allowed.has(extension);
  }

  private toWritePayload(): AdminProductWritePayload {
    const value = this.form.getRawValue();
    const language = this.language();
    const description = value.description.trim();

    return {
      categoryId: value.categoryId,
      name: upsertLocalizedText(this.existingProduct?.name, language, value.name),
      ...(description
        ? {
            description: upsertLocalizedText(
              this.existingProduct?.description,
              language,
              description,
            ),
          }
        : {}),
      basePrice: majorUnitsToCents(value.price),
      availability: value.availability,
      allergenIds: [...this.selectedAllergenIds()],
      dietaryTagIds: [...this.selectedDietaryTagIds()],
      servedStartMinuteOfDay: value.servedStart
        ? timeToMinutes(value.servedStart)
        : null,
      servedEndMinuteOfDay: value.servedEnd
        ? timeToMinutes(value.servedEnd)
        : null,
    };
  }

  private messageForLoadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      if (code === 'PRODUCT_NOT_FOUND') {
        return 'El producto no existe en este restaurante.';
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
        case 'CATEGORY_NOT_FOUND':
          return 'La categoría no existe en este restaurante.';
        case 'PLAN_LIMIT_EXCEEDED':
          return 'Alcanzaste el límite de productos de tu plan.';
        case 'PRODUCT_NOT_FOUND':
          return 'El producto ya no existe.';
        case 'VALIDATION_ERROR':
          return (
            extractApiErrorMessage(error.error) ??
            'Revisá los datos del formulario.'
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
    return 'No pudimos guardar el producto. Intentá de nuevo.';
  }

  private messageForUploadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      switch (code) {
        case 'UNSUPPORTED_MEDIA_TYPE':
          return 'Revisá el tipo de archivo: imagen (.jpg, .png, .webp) o modelo 3D (.glb, .usdz).';
        case 'MEDIA_SLOT_TYPE_MISMATCH':
          return (
            extractApiErrorMessage(error.error) ??
            'Ese archivo no corresponde a esta zona de carga.'
          );
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
        case 'PRODUCT_NOT_FOUND':
          return 'El producto no existe en este restaurante.';
      }
      if (error.status === 413) {
        return 'El archivo supera el tamaño máximo permitido.';
      }
      if (error.status === 0) {
        return 'Se cortó la conexión al subir el archivo. Si el modelo es pesado, esperá un momento y reintentá; si sigue fallando, revisá que la API esté en marcha.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return 'No pudimos subir el archivo. Intentá de nuevo.';
  }

  private messageForRemoveError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      if (code === 'PRODUCT_NOT_FOUND') {
        return 'El producto no existe en este restaurante.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return 'No pudimos quitar el archivo. Intentá de nuevo.';
  }
}

function servingHoursPairValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const start = String(control.get('servedStart')?.value ?? '').trim();
  const end = String(control.get('servedEnd')?.value ?? '').trim();
  if (!start && !end) {
    return null;
  }
  if (!start || !end) {
    return { servingHoursPair: true };
  }
  if (start === end) {
    return { servingHoursSame: true };
  }
  return null;
}

function toggleId(current: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}
