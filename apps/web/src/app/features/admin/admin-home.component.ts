import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="px-4 py-8">
      <h1 class="text-lg font-bold text-neutral-900">Bienvenido</h1>
      <p class="mt-1 text-sm text-neutral-500">
        Sesión iniciada como
        <span class="font-medium text-neutral-800">{{ currentUser()?.email }}</span>.
      </p>
    </section>
  `,
})
export class AdminHomeComponent {
  private readonly authStore = inject(AuthStore);
  protected readonly currentUser = this.authStore.currentUser;
}
