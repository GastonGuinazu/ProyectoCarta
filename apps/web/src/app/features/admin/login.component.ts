import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly pending = this.authStore.pending;
  protected readonly loginError = this.authStore.loginError;

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    if (this.authStore.isAuthenticated()) {
      void this.router.navigateByUrl('/admin');
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    try {
      await this.authStore.login(email, password);
      await this.router.navigateByUrl('/admin');
    } catch {
      // El mensaje ya quedó en `loginError` del store.
    }
  }
}
