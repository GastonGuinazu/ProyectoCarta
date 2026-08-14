import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { AuthStore } from '../../core/auth/auth.store';
import {
  extractApiErrorCode,
  extractApiErrorMessage,
} from '../../utils/api-error.utils';

@Component({
  selector: 'app-admin-account',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.component.html',
})
export class AccountComponent {
  private readonly authStore = inject(AuthStore);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly currentUser = this.authStore.currentUser;
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveNotice = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

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
    this.saveNotice.set(null);

    try {
      const value = this.form.getRawValue();
      await this.authStore.changePassword(value.currentPassword, value.newPassword);
      this.form.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      this.saveNotice.set('Contraseña actualizada. Seguí usando esta sesión.');
    } catch (error: unknown) {
      this.saveError.set(this.messageForError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private messageForError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const code = extractApiErrorCode(error.error);
      switch (code) {
        case 'CURRENT_PASSWORD_INVALID':
          return 'La contraseña actual no es correcta.';
        case 'NEW_PASSWORD_MUST_DIFFER':
          return 'La contraseña nueva tiene que ser distinta de la actual.';
        case 'ACCOUNT_DISABLED':
          return 'Esta cuenta no está activa.';
      }
      if (error.status === 0) {
        return 'No pudimos conectar con el servidor. Intentá de nuevo.';
      }
      const message = extractApiErrorMessage(error.error);
      if (message) {
        return message;
      }
    }
    return 'No pudimos cambiar la contraseña. Intentá de nuevo.';
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
