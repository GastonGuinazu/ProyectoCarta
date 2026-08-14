import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { AdminCatalogApiService } from './admin-catalog-api.service';
import type { AdminCategorySummary } from './admin-catalog.models';

const REORDER_DEBOUNCE_MS = 280;

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-list.component.html',
})
export class CategoryListComponent implements OnDestroy {
  private readonly catalogApi = inject(AdminCatalogApiService);
  private readonly authStore = inject(AuthStore);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly categories = signal<readonly AdminCategorySummary[]>([]);
  protected readonly pending = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly reorderError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editorOpen = signal(false);
  protected readonly editingCategory = signal<AdminCategorySummary | null>(null);
  protected readonly pendingDelete = signal<AdminCategorySummary | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });

  protected readonly editorTitle = computed(() =>
    this.editingCategory() ? 'Editar categoría' : 'Nueva categoría',
  );

  private lastConfirmed: readonly AdminCategorySummary[] = [];
  private reorderTimer: ReturnType<typeof setTimeout> | null = null;
  private reorderInFlight = false;

  private readonly language = computed(
    () => this.authStore.currentUser()?.preferredLanguage ?? 'es',
  );

  constructor() {
    void this.loadCategories();
  }

  ngOnDestroy(): void {
    if (this.reorderTimer) {
      clearTimeout(this.reorderTimer);
    }
  }

  protected categoryName(category: AdminCategorySummary): string {
    return pickLocalizedText(category.name, this.language());
  }

  protected canDelete(category: AdminCategorySummary): boolean {
    return category.productCount === 0 && category.childCount === 0;
  }

  protected deleteBlockedReason(category: AdminCategorySummary): string {
    const parts: string[] = [];
    if (category.productCount > 0) {
      parts.push(
        category.productCount === 1
          ? '1 producto'
          : `${category.productCount} productos`,
      );
    }
    if (category.childCount > 0) {
      parts.push(
        category.childCount === 1
          ? '1 subcategoría'
          : `${category.childCount} subcategorías`,
      );
    }
    return `No se puede eliminar: tiene ${parts.join(' y ')}. Reasignalos o eliminalos antes.`;
  }

  protected openCreate(): void {
    this.editingCategory.set(null);
    this.form.reset({ name: '' });
    this.formError.set(null);
    this.editorOpen.set(true);
  }

  protected openEdit(category: AdminCategorySummary): void {
    this.editingCategory.set(category);
    this.form.reset({ name: this.categoryName(category) });
    this.formError.set(null);
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    if (this.saving()) {
      return;
    }
    this.editorOpen.set(false);
    this.editingCategory.set(null);
  }

  protected askDelete(category: AdminCategorySummary): void {
    this.pendingDelete.set(category);
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  protected moveUp(index: number): void {
    if (index <= 0) {
      return;
    }
    this.applySwap(index, index - 1);
  }

  protected moveDown(index: number): void {
    if (index >= this.categories().length - 1) {
      return;
    }
    this.applySwap(index, index + 1);
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.form.controls.name.value.trim();
    if (!name) {
      this.form.controls.name.setErrors({ required: true });
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    const editing = this.editingCategory();
    const payload = {
      name: upsertLocalizedText(editing?.name, this.language(), name),
    };

    try {
      if (editing) {
        const updated = await firstValueFrom(
          this.catalogApi.updateCategory(editing.id, payload),
        );
        this.replaceCategory(updated);
      } else {
        const created = await firstValueFrom(
          this.catalogApi.createCategory(payload),
        );
        const next = [...this.categories(), created];
        this.categories.set(next);
        this.lastConfirmed = next;
      }
      this.editorOpen.set(false);
      this.editingCategory.set(null);
    } catch (error: unknown) {
      this.formError.set(this.messageForMutation(error, 'save'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const category = this.pendingDelete();
    if (!category) {
      return;
    }

    this.saving.set(true);
    try {
      await firstValueFrom(this.catalogApi.deleteCategory(category.id));
      const next = this.categories().filter((item) => item.id !== category.id);
      this.categories.set(next);
      this.lastConfirmed = next;
      this.pendingDelete.set(null);
    } catch (error: unknown) {
      this.loadError.set(this.messageForMutation(error, 'delete'));
      this.pendingDelete.set(null);
    } finally {
      this.saving.set(false);
    }
  }

  private applySwap(from: number, to: number): void {
    const next = [...this.categories()];
    const [item] = next.splice(from, 1);
    if (!item) {
      return;
    }
    next.splice(to, 0, item);
    this.categories.set(next.map((category, order) => ({ ...category, order })));
    this.schedulePersist();
  }

  private schedulePersist(): void {
    if (this.reorderTimer) {
      clearTimeout(this.reorderTimer);
    }
    this.reorderTimer = setTimeout(() => {
      void this.flushReorder();
    }, REORDER_DEBOUNCE_MS);
  }

  private async flushReorder(): Promise<void> {
    if (this.reorderInFlight) {
      this.schedulePersist();
      return;
    }

    const snapshot = this.categories();
    const categoryIds = snapshot.map((category) => category.id);
    if (this.sameOrder(categoryIds, this.lastConfirmed)) {
      return;
    }

    this.reorderInFlight = true;
    try {
      const response = await firstValueFrom(
        this.catalogApi.reorderCategories({ categoryIds }),
      );
      this.lastConfirmed = response.items;
      if (this.sameOrder(
        this.categories().map((category) => category.id),
        snapshot,
      )) {
        this.categories.set(response.items);
      }
      this.reorderError.set(null);
    } catch {
      this.categories.set(this.lastConfirmed);
      this.reorderError.set(
        'No pudimos guardar el nuevo orden. Lo restauramos al último guardado.',
      );
    } finally {
      this.reorderInFlight = false;
      if (
        !this.sameOrder(
          this.categories().map((category) => category.id),
          this.lastConfirmed,
        )
      ) {
        void this.flushReorder();
      }
    }
  }

  private replaceCategory(updated: AdminCategorySummary): void {
    const next = this.categories().map((item) =>
      item.id === updated.id ? updated : item,
    );
    this.categories.set(next);
    this.lastConfirmed = next;
  }

  private sameOrder(
    ids: readonly string[],
    categories: readonly AdminCategorySummary[],
  ): boolean {
    if (ids.length !== categories.length) {
      return false;
    }
    return ids.every((id, index) => id === categories[index]?.id);
  }

  private async loadCategories(): Promise<void> {
    this.pending.set(true);
    this.loadError.set(null);
    try {
      const response = await firstValueFrom(this.catalogApi.listCategories());
      this.categories.set(response.items);
      this.lastConfirmed = response.items;
    } catch {
      this.categories.set([]);
      this.lastConfirmed = [];
      this.loadError.set('No pudimos cargar las categorías. Intentá de nuevo.');
    } finally {
      this.pending.set(false);
    }
  }

  private messageForMutation(
    error: unknown,
    kind: 'save' | 'delete',
  ): string {
    if (!(error instanceof HttpErrorResponse)) {
      return kind === 'delete'
        ? 'No se pudo eliminar la categoría.'
        : 'No se pudo guardar la categoría.';
    }
    const code = extractApiErrorCode(error.error);
    if (code === 'CATEGORY_IN_USE') {
      return 'Esta categoría tiene productos o subcategorías. Reasignalos antes de eliminarla.';
    }
    return (
      extractApiErrorMessage(error.error) ??
      (kind === 'delete'
        ? 'No se pudo eliminar la categoría.'
        : 'No se pudo guardar la categoría.')
    );
  }
}
