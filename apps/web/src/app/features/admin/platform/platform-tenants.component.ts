import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../../utils/api-error.utils';
import { AdminPlatformApiService } from './admin-platform-api.service';
import type {
  PlatformTenantListItem,
  PlatformTenantStatus,
} from './admin-platform.models';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Component({
  selector: 'app-platform-tenants',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-tenants.component.html',
})
export class PlatformTenantsComponent implements OnInit {
  private readonly platformApi = inject(AdminPlatformApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly tenants = signal<readonly PlatformTenantListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly createdNotice = signal<string | null>(null);
  protected readonly pendingStatus = signal<{
    readonly tenant: PlatformTenantListItem;
    readonly nextStatus: Extract<PlatformTenantStatus, 'ACTIVE' | 'SUSPENDED'>;
  } | null>(null);
  protected readonly statusSaving = signal(false);
  protected readonly statusError = signal<string | null>(null);
  protected readonly pendingReset = signal<PlatformTenantListItem | null>(null);
  protected readonly resetSaving = signal(false);
  protected readonly resetError = signal<string | null>(null);

  private tenantSlugTouched = false;
  private branchSlugTouched = false;

  protected readonly form = this.formBuilder.nonNullable.group({
    commercialName: ['', [Validators.required, Validators.maxLength(120)]],
    tenantSlug: [
      '',
      [Validators.required, Validators.minLength(2), Validators.pattern(SLUG_PATTERN)],
    ],
    branchName: ['Casa Matriz', [Validators.required, Validators.maxLength(120)]],
    branchSlug: [
      'casa-matriz',
      [Validators.required, Validators.minLength(2), Validators.pattern(SLUG_PATTERN)],
    ],
    ownerFullName: ['', [Validators.required, Validators.maxLength(120)]],
    ownerEmail: ['', [Validators.required, Validators.email]],
    ownerPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly resetForm = this.formBuilder.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  ngOnInit(): void {
    void this.load();
  }

  protected openModal(): void {
    this.saveError.set(null);
    this.tenantSlugTouched = false;
    this.branchSlugTouched = false;
    this.form.reset({
      commercialName: '',
      tenantSlug: '',
      branchName: 'Casa Matriz',
      branchSlug: 'casa-matriz',
      ownerFullName: '',
      ownerEmail: '',
      ownerPassword: '',
    });
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    if (this.saving()) {
      return;
    }
    this.modalOpen.set(false);
  }

  protected onCommercialNameInput(): void {
    if (this.tenantSlugTouched) {
      return;
    }
    const slug = slugify(this.form.controls.commercialName.value);
    this.form.controls.tenantSlug.setValue(slug, { emitEvent: false });
  }

  protected onTenantSlugInput(): void {
    this.tenantSlugTouched = true;
  }

  protected onBranchNameInput(): void {
    if (this.branchSlugTouched) {
      return;
    }
    const slug = slugify(this.form.controls.branchName.value) || 'casa-matriz';
    this.form.controls.branchSlug.setValue(slug, { emitEvent: false });
  }

  protected onBranchSlugInput(): void {
    this.branchSlugTouched = true;
  }

  protected statusLabel(status: PlatformTenantStatus): string {
    switch (status) {
      case 'TRIAL':
        return 'Prueba';
      case 'ACTIVE':
        return 'Activo';
      case 'SUSPENDED':
        return 'Suspendido';
      case 'CANCELLED':
        return 'Cancelado';
    }
  }

  protected canSuspend(status: PlatformTenantStatus): boolean {
    return status === 'TRIAL' || status === 'ACTIVE';
  }

  protected canReactivate(status: PlatformTenantStatus): boolean {
    return status === 'SUSPENDED' || status === 'CANCELLED';
  }

  protected askSuspend(tenant: PlatformTenantListItem): void {
    if (this.statusSaving()) {
      return;
    }
    this.statusError.set(null);
    this.pendingStatus.set({ tenant, nextStatus: 'SUSPENDED' });
  }

  protected askReactivate(tenant: PlatformTenantListItem): void {
    if (this.statusSaving()) {
      return;
    }
    this.statusError.set(null);
    this.pendingStatus.set({ tenant, nextStatus: 'ACTIVE' });
  }

  protected cancelStatusChange(): void {
    if (this.statusSaving()) {
      return;
    }
    this.pendingStatus.set(null);
  }

  protected askReset(tenant: PlatformTenantListItem): void {
    if (this.resetSaving() || !tenant.ownerEmail) {
      return;
    }
    this.resetError.set(null);
    this.resetForm.reset({ newPassword: '', confirmPassword: '' });
    this.pendingReset.set(tenant);
  }

  protected cancelReset(): void {
    if (this.resetSaving()) {
      return;
    }
    this.pendingReset.set(null);
  }

  protected async confirmReset(): Promise<void> {
    const tenant = this.pendingReset();
    if (!tenant || this.resetSaving()) {
      return;
    }
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.resetSaving.set(true);
    this.resetError.set(null);

    try {
      const updated = await firstValueFrom(
        this.platformApi.resetOwnerPassword(
          tenant.id,
          this.resetForm.getRawValue().newPassword,
        ),
      );
      this.tenants.update((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row)),
      );
      this.pendingReset.set(null);
      this.createdNotice.set(
        `Se reseteó la clave de ${updated.ownerEmail ?? 'el dueño'}. Decile que entre con la nueva; las sesiones anteriores se cerraron.`,
      );
    } catch (error: unknown) {
      this.resetError.set(this.messageForResetError(error));
    } finally {
      this.resetSaving.set(false);
    }
  }

  protected async confirmStatusChange(): Promise<void> {
    const pending = this.pendingStatus();
    if (!pending || this.statusSaving()) {
      return;
    }

    this.statusSaving.set(true);
    this.statusError.set(null);

    try {
      const updated = await firstValueFrom(
        this.platformApi.updateTenantStatus(pending.tenant.id, pending.nextStatus),
      );
      this.tenants.update((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row)),
      );
      this.pendingStatus.set(null);
      this.createdNotice.set(
        pending.nextStatus === 'SUSPENDED'
          ? `Se suspendió ${updated.name}. La carta pública no funciona hasta que la reactives.`
          : `Se reactivó ${updated.name}. La carta y el panel del dueño vuelven a funcionar.`,
      );
    } catch (error: unknown) {
      this.statusError.set(this.messageForStatusError(error));
      this.pendingStatus.set(null);
    } finally {
      this.statusSaving.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (this.saving()) {
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
      const created = await firstValueFrom(
        this.platformApi.createTenant({
          commercialName: value.commercialName.trim(),
          tenantSlug: value.tenantSlug.trim().toLowerCase(),
          branchName: value.branchName.trim() || 'Casa Matriz',
          branchSlug: value.branchSlug.trim().toLowerCase(),
          ownerFullName: value.ownerFullName.trim(),
          ownerEmail: value.ownerEmail.trim().toLowerCase(),
          ownerPassword: value.ownerPassword,
        }),
      );
      this.modalOpen.set(false);
      this.createdNotice.set(
        `Se creó ${created.tenantName}. El dueño puede entrar con ${created.ownerEmail}.`,
      );
      await this.load();
    } catch (error: unknown) {
      this.saveError.set(this.messageForSaveError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const tenants = await firstValueFrom(this.platformApi.listTenants());
      this.tenants.set(tenants);
    } catch (error: unknown) {
      this.loadError.set(this.messageForLoadError(error));
    } finally {
      this.loading.set(false);
    }
  }

  private messageForLoadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Revisá que la API esté en marcha.';
      }
      if (extractApiErrorCode(error.error) === 'TENANT_OR_BRANCH_NOT_FOUND') {
        return 'El tenant de impersonación ya no existe. Recargá e intentá de nuevo.';
      }
    }
    return 'No pudimos cargar los restaurantes. Intentá de nuevo.';
  }

  private messageForSaveError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      switch (code) {
        case 'TENANT_SLUG_TAKEN':
          return 'Ese slug de restaurante ya está en uso.';
        case 'OWNER_EMAIL_TAKEN':
          return 'Ya existe un usuario con ese email.';
        case 'PLAN_NOT_CONFIGURED':
          return 'No hay un plan de suscripción cargado. Sembrá los planes primero.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return 'No pudimos crear el restaurante. Intentá de nuevo.';
  }

  private messageForStatusError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (extractApiErrorCode(error.error) === 'TENANT_NOT_FOUND') {
        return 'No encontramos ese restaurante. Recargá la lista.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return 'No pudimos actualizar el estado. Intentá de nuevo.';
  }

  private messageForResetError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      if (code === 'TENANT_NOT_FOUND') {
        return 'No encontramos ese restaurante. Recargá la lista.';
      }
      if (code === 'OWNER_NOT_FOUND') {
        return 'Ese restaurante no tiene un usuario dueño.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return 'No pudimos resetear la contraseña. Intentá de nuevo.';
  }
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const neu = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (typeof neu !== 'string' || typeof confirm !== 'string' || confirm.length === 0) {
    return null;
  }
  return neu === confirm ? null : { passwordMismatch: true };
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug;
}
