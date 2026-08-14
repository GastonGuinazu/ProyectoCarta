import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../../utils/api-error.utils';
import { AdminBranchApiService } from './admin-branch-api.service';
import type {
  AdminBranchListItem,
  BranchOperationalStatus,
} from './admin-branch.models';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './branch-list.component.html',
})
export class BranchListComponent implements OnInit {
  private readonly branchApi = inject(AdminBranchApiService);
  private readonly authStore = inject(AuthStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  protected readonly branches = signal<readonly AdminBranchListItem[]>([]);
  protected readonly maxBranches = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly dialog = signal<'create' | 'rename' | null>(null);
  protected readonly editingBranch = signal<AdminBranchListItem | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly createdNotice = signal<string | null>(null);
  protected readonly copiedBranchId = signal<string | null>(null);

  private slugTouched = false;
  private copyReset: ReturnType<typeof setTimeout> | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    slug: [
      '',
      [Validators.required, Validators.minLength(2), Validators.pattern(SLUG_PATTERN)],
    ],
    copyCatalogFromBranchId: [''],
  });

  protected readonly canCreate = computed(
    () => this.branches().length < this.maxBranches(),
  );

  protected readonly listedTenantSlug = signal<string | null>(null);
  protected readonly tenantSlug = computed(
    () => this.authStore.tenant()?.slug ?? this.listedTenantSlug(),
  );

  ngOnInit(): void {
    void this.load();
  }

  protected statusLabel(status: BranchOperationalStatus): string {
    switch (status) {
      case 'OPEN':
        return 'Abierta';
      case 'CLOSED_TEMPORARILY':
        return 'Cerrada';
      case 'MAINTENANCE':
        return 'Mantenimiento';
    }
  }

  protected publicUrl(branch: AdminBranchListItem): string | null {
    const tenantSlug = this.tenantSlug();
    const origin = this.document.defaultView?.location.origin;
    if (!tenantSlug || !origin) {
      return null;
    }
    return `${origin}/m/${tenantSlug}/${branch.slug}`;
  }

  protected isActive(branchId: string): boolean {
    return this.authStore.activeBranchId() === branchId;
  }

  protected selectBranch(branchId: string): void {
    this.authStore.setActiveBranch(branchId);
  }

  protected configureBranch(branchId: string): void {
    this.authStore.setActiveBranch(branchId);
    void this.router.navigateByUrl('/admin/settings');
  }

  protected async copyMenuLink(branch: AdminBranchListItem): Promise<void> {
    const url = this.publicUrl(branch);
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!url || !clipboard) {
      return;
    }
    try {
      await clipboard.writeText(url);
      this.copiedBranchId.set(branch.id);
      if (this.copyReset) {
        this.document.defaultView?.clearTimeout(this.copyReset);
      }
      this.copyReset = this.document.defaultView?.setTimeout(() => {
        this.copiedBranchId.set(null);
      }, 2000) ?? null;
    } catch {
      this.copiedBranchId.set(null);
    }
  }

  protected openCreate(): void {
    if (!this.canCreate()) {
      return;
    }
    this.saveError.set(null);
    this.slugTouched = false;
    this.editingBranch.set(null);
    const sourceId =
      this.authStore.activeBranchId() ?? this.branches()[0]?.id ?? '';
    this.form.reset({
      name: '',
      slug: '',
      copyCatalogFromBranchId: sourceId,
    });
    this.dialog.set('create');
  }

  protected openRename(branch: AdminBranchListItem): void {
    this.saveError.set(null);
    this.slugTouched = true;
    this.editingBranch.set(branch);
    this.form.reset({
      name: branch.name,
      slug: branch.slug,
      copyCatalogFromBranchId: '',
    });
    this.dialog.set('rename');
  }

  protected closeDialog(): void {
    if (this.saving()) {
      return;
    }
    this.dialog.set(null);
    this.editingBranch.set(null);
  }

  protected onNameInput(): void {
    if (this.dialog() !== 'create' || this.slugTouched) {
      return;
    }
    this.form.controls.slug.setValue(slugify(this.form.controls.name.value), {
      emitEvent: false,
    });
  }

  protected onSlugInput(): void {
    this.slugTouched = true;
  }

  protected async submit(): Promise<void> {
    if (this.dialog() === 'create') {
      await this.submitCreate();
      return;
    }
    if (this.dialog() === 'rename') {
      await this.submitRename();
    }
  }

  private async submitCreate(): Promise<void> {
    if (this.saving()) {
      return;
    }
    if (this.form.controls.name.invalid || this.form.controls.slug.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    try {
      const value = this.form.getRawValue();
      const sourceId =
        value.copyCatalogFromBranchId || this.branches()[0]?.id || undefined;
      const created = await firstValueFrom(
        this.branchApi.create({
          name: value.name.trim(),
          slug: value.slug.trim().toLowerCase(),
          ...(sourceId ? { copyCatalogFromBranchId: sourceId } : {}),
        }),
      );
      this.authStore.upsertAccessibleBranch({
        id: created.id,
        slug: created.slug,
        name: created.name,
      });
      this.authStore.setActiveBranch(created.id);
      this.dialog.set(null);
      this.createdNotice.set(
        `Se creó ${created.name}. La carta queda en /m/${this.tenantSlug() ?? '…'}/${created.slug}.`,
      );
      await this.load();
    } catch (error: unknown) {
      this.saveError.set(this.messageForSaveError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async submitRename(): Promise<void> {
    if (this.saving()) {
      return;
    }
    const branch = this.editingBranch();
    if (!branch) {
      return;
    }
    if (this.form.controls.name.invalid || this.form.controls.slug.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    try {
      const value = this.form.getRawValue();
      const updated = await firstValueFrom(
        this.branchApi.update(branch.id, {
          name: value.name.trim(),
          slug: value.slug.trim().toLowerCase(),
        }),
      );
      this.authStore.upsertAccessibleBranch({
        id: updated.id,
        slug: updated.slug,
        name: updated.name,
      });
      this.dialog.set(null);
      this.editingBranch.set(null);
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
      const result = await firstValueFrom(this.branchApi.list());
      this.branches.set(result.branches);
      this.maxBranches.set(result.maxBranches);
      this.listedTenantSlug.set(result.tenantSlug);
      this.authStore.replaceAccessibleBranches(
        result.branches.map((branch) => ({
          id: branch.id,
          slug: branch.slug,
          name: branch.name,
        })),
      );
    } catch (error: unknown) {
      this.loadError.set(this.messageForLoadError(error));
    } finally {
      this.loading.set(false);
    }
  }

  private messageForLoadError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'No pudimos conectar con el servidor. Intentá de nuevo.';
    }
    return 'No pudimos cargar las sucursales. Intentá de nuevo.';
  }

  private messageForSaveError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      switch (code) {
        case 'BRANCH_SLUG_TAKEN':
          return 'Ese slug de sucursal ya está en uso en este restaurante.';
        case 'BRANCH_LIMIT_REACHED':
          return (
            extractApiErrorMessage(error.error) ??
            'Alcanzaste el límite de sucursales de tu plan.'
          );
        case 'SOURCE_BRANCH_NOT_FOUND':
          return 'La sucursal de origen del menú ya no existe.';
        case 'BRANCH_NOT_FOUND':
          return 'Esa sucursal ya no existe.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return this.dialog() === 'rename'
      ? 'No pudimos guardar los cambios. Intentá de nuevo.'
      : 'No pudimos crear la sucursal. Intentá de nuevo.';
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
