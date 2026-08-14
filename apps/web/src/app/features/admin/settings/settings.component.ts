import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../../utils/api-error.utils';
import { drawMenuQr, menuQrPngDataUrl } from '../../../utils/menu-qr';
import { BRANCH_TIMEZONE_OPTIONS } from './branch-timezones';
import { AdminSettingsApiService } from './admin-settings-api.service';
import type {
  AdminBrandingSlot,
  BranchOperationalStatus,
} from './admin-settings.models';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const FALLBACK_ACCENT = '#171717';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  private readonly settingsApi = inject(AdminSettingsApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly document = inject(DOCUMENT);
  private readonly qrCanvas = viewChild<ElementRef<HTMLCanvasElement>>('qrCanvas');

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploadingSlot = signal<AdminBrandingSlot | null>(null);
  protected readonly removingSlot = signal<AdminBrandingSlot | null>(null);
  protected readonly pendingRemoveSlot = signal<AdminBrandingSlot | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly isDragOver = signal<AdminBrandingSlot | null>(null);
  protected readonly logoPreview = signal<string | null>(null);
  protected readonly bannerPreview = signal<string | null>(null);
  protected readonly settingsTenantSlug = signal<string | null>(null);
  protected readonly settingsBranchSlug = signal<string | null>(null);
  protected readonly linkCopied = signal(false);
  private initialized = false;
  private readonly loadedBranchId = signal<string | null>(null);

  protected readonly menuPublicUrl = computed(() => {
    const tenantSlug = this.authStore.tenant()?.slug ?? this.settingsTenantSlug();
    const activeId = this.authStore.activeBranchId();
    const fromAuth = this.authStore
      .accessibleBranches()
      .find((branch) => branch.id === activeId)?.slug;
    const branchSlug = fromAuth ?? this.settingsBranchSlug();
    const origin = this.document.defaultView?.location.origin;
    if (!tenantSlug || !branchSlug || !origin) {
      return null;
    }
    return `${origin}/m/${tenantSlug}/${branchSlug}`;
  });

  ngOnInit(): void {
    void this.load();
  }

  constructor() {
    effect(() => {
      const canvas = this.qrCanvas()?.nativeElement;
      const url = this.menuPublicUrl();
      if (!url || !canvas) {
        return;
      }
      drawMenuQr(canvas, url);
    });

    effect(() => {
      const branchId = this.authStore.activeBranchId();
      if (!this.initialized || !branchId) {
        return;
      }
      if (branchId !== this.loadedBranchId()) {
        void this.load();
      }
    });
  }

  protected readonly form = this.formBuilder.nonNullable.group({
    commercialName: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', Validators.maxLength(40)],
    whatsapp: ['', Validators.maxLength(40)],
    instagram: ['', Validators.maxLength(255)],
    address: ['', Validators.maxLength(255)],
    accentColor: [
      FALLBACK_ACCENT,
      [Validators.required, Validators.pattern(HEX_COLOR)],
    ],
    operationalStatus: ['OPEN' as BranchOperationalStatus, Validators.required],
    timezone: ['America/Argentina/Buenos_Aires', Validators.required],
  });

  protected timezoneSelectOptions(): readonly {
    readonly value: string;
    readonly label: string;
  }[] {
    const current = this.form.controls.timezone.value;
    if (BRANCH_TIMEZONE_OPTIONS.some((option) => option.value === current)) {
      return BRANCH_TIMEZONE_OPTIONS;
    }
    return [...BRANCH_TIMEZONE_OPTIONS, { value: current, label: current }];
  }

  protected onAccentTyped(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    if (HEX_COLOR.test(value)) {
      this.form.controls.accentColor.setValue(value.toUpperCase());
    }
  }

  protected onDragOver(event: DragEvent, slot: AdminBrandingSlot): void {
    event.preventDefault();
    if (!this.uploadingSlot() && !this.removingSlot()) {
      this.isDragOver.set(slot);
    }
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(null);
  }

  protected onDrop(event: DragEvent, slot: AdminBrandingSlot): void {
    event.preventDefault();
    this.isDragOver.set(null);
    const file = event.dataTransfer?.files.item(0);
    if (file) {
      void this.uploadFile(file, slot);
    }
  }

  protected onFileSelected(event: Event, slot: AdminBrandingSlot): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.item(0);
    inputEl.value = '';
    if (file) {
      void this.uploadFile(file, slot);
    }
  }

  protected askRemove(slot: AdminBrandingSlot): void {
    if (this.uploadingSlot() || this.removingSlot()) {
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
    if (!slot || this.removingSlot()) {
      return;
    }

    this.removingSlot.set(slot);
    this.uploadError.set(null);

    try {
      await firstValueFrom(this.settingsApi.deleteBranding(slot));
      if (slot === 'logo') {
        this.logoPreview.set(null);
      } else {
        this.bannerPreview.set(null);
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
      const value = this.form.getRawValue();
      const updated = await firstValueFrom(
        this.settingsApi.updateBranchSettings({
          commercialName: value.commercialName.trim(),
          phone: emptyToNull(value.phone),
          whatsapp: emptyToNull(value.whatsapp),
          instagram: emptyToNull(value.instagram),
          address: emptyToNull(value.address),
          accentColor: value.accentColor.toUpperCase(),
          operationalStatus: value.operationalStatus,
          timezone: value.timezone,
        }),
      );
      this.applySettings(updated);
    } catch (error: unknown) {
      this.saveError.set(this.messageForSaveError(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async copyMenuLink(): Promise<void> {
    const url = this.menuPublicUrl();
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!url || !clipboard) {
      return;
    }
    try {
      await clipboard.writeText(url);
      this.linkCopied.set(true);
      this.document.defaultView?.setTimeout(() => this.linkCopied.set(false), 2000);
    } catch {
      this.linkCopied.set(false);
    }
  }

  protected downloadQrPng(): void {
    const url = this.menuPublicUrl();
    if (!url) {
      return;
    }
    const dataUrl = menuQrPngDataUrl(url, this.document);
    const tenantSlug = this.authStore.tenant()?.slug ?? this.settingsTenantSlug() ?? 'menu';
    const activeId = this.authStore.activeBranchId();
    const branchSlug =
      this.authStore.accessibleBranches().find((branch) => branch.id === activeId)?.slug ??
      this.settingsBranchSlug() ??
      'sucursal';
    const anchor = this.document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `qr-${tenantSlug}-${branchSlug}.png`;
    this.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const settings = await firstValueFrom(this.settingsApi.getBranchSettings());
      this.applySettings(settings);
    } catch (error: unknown) {
      this.loadError.set(this.messageForLoadError(error));
    } finally {
      this.loading.set(false);
      this.initialized = true;
    }
  }

  private applySettings(settings: {
    readonly branchId: string;
    readonly tenantSlug: string;
    readonly branchSlug: string;
    readonly commercialName: string;
    readonly phone: string | null;
    readonly whatsapp: string | null;
    readonly instagram: string | null;
    readonly address: string | null;
    readonly accentColor: string | null;
    readonly logoUrl: string | null;
    readonly bannerUrl: string | null;
    readonly operationalStatus: BranchOperationalStatus;
    readonly timezone: string;
  }): void {
    this.settingsTenantSlug.set(settings.tenantSlug);
    this.settingsBranchSlug.set(settings.branchSlug);
    this.loadedBranchId.set(settings.branchId);
    this.form.patchValue({
      commercialName: settings.commercialName,
      phone: settings.phone ?? '',
      whatsapp: settings.whatsapp ?? '',
      instagram: settings.instagram ?? '',
      address: settings.address ?? '',
      accentColor: settings.accentColor ?? FALLBACK_ACCENT,
      operationalStatus: settings.operationalStatus,
      timezone: settings.timezone,
    });
    this.logoPreview.set(settings.logoUrl);
    this.bannerPreview.set(settings.bannerUrl);
  }

  private async uploadFile(file: File, slot: AdminBrandingSlot): Promise<void> {
    if (this.uploadingSlot() || this.removingSlot()) {
      return;
    }
    if (!this.fileIsImage(file)) {
      this.uploadError.set('El logo y la portada solo aceptan .jpg, .png o .webp.');
      return;
    }

    this.uploadingSlot.set(slot);
    this.uploadError.set(null);
    const localUrl = URL.createObjectURL(file);
    if (slot === 'logo') {
      this.logoPreview.set(localUrl);
    } else {
      this.bannerPreview.set(localUrl);
    }

    try {
      const uploaded = await firstValueFrom(
        this.settingsApi.uploadBranding(slot, file),
      );
      if (slot === 'logo') {
        this.logoPreview.set(uploaded.publicUrl);
      } else {
        this.bannerPreview.set(uploaded.publicUrl);
      }
    } catch (error: unknown) {
      this.uploadError.set(this.messageForUploadError(error));
      await this.reloadPreviews();
    } finally {
      URL.revokeObjectURL(localUrl);
      this.uploadingSlot.set(null);
    }
  }

  private async reloadPreviews(): Promise<void> {
    try {
      const settings = await firstValueFrom(this.settingsApi.getBranchSettings());
      this.logoPreview.set(settings.logoUrl);
      this.bannerPreview.set(settings.bannerUrl);
    } catch {
      this.logoPreview.set(null);
      this.bannerPreview.set(null);
    }
  }

  private fileIsImage(file: File): boolean {
    const name = file.name.toLowerCase();
    const lastDot = name.lastIndexOf('.');
    const extension = lastDot >= 0 ? name.slice(lastDot) : '';
    return IMAGE_EXTENSIONS.has(extension);
  }

  private messageForLoadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (extractApiErrorCode(error.error) === 'BRANCH_NOT_FOUND') {
        return 'Este restaurante todavía no tiene una sucursal.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
    }
    return 'No pudimos cargar la configuración. Intentá de nuevo.';
  }

  private messageForSaveError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return 'No pudimos guardar la configuración. Intentá de nuevo.';
  }

  private messageForUploadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      switch (code) {
        case 'UNSUPPORTED_MEDIA_TYPE':
        case 'MEDIA_SLOT_TYPE_MISMATCH':
          return 'El logo y la portada solo aceptan .jpg, .png o .webp.';
        case 'MEDIA_FILE_TOO_LARGE':
          return 'El archivo supera el tamaño máximo de 10 MB.';
        case 'STORAGE_QUOTA_EXCEEDED':
          return 'Alcanzaste el límite de almacenamiento de tu plan.';
        case 'STORAGE_NOT_CONFIGURED':
          return 'Falta configurar el almacenamiento de archivos en el servidor.';
        case 'BRANCH_NOT_FOUND':
          return 'Este restaurante todavía no tiene una sucursal.';
      }
      if (error.status === 413) {
        return 'El archivo supera el tamaño máximo de 10 MB.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
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
      if (extractApiErrorCode(error.error) === 'BRANCH_NOT_FOUND') {
        return 'Este restaurante todavía no tiene una sucursal.';
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

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
