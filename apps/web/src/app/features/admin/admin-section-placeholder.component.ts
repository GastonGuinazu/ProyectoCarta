import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-admin-section-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="px-4 py-8 sm:px-6">
      <h1 class="text-lg font-bold text-neutral-900">{{ title }}</h1>
      <p class="mt-1 text-sm text-neutral-500">Esta sección se construye en un próximo paso.</p>
    </section>
  `,
})
export class AdminSectionPlaceholderComponent {
  protected readonly title =
    (inject(ActivatedRoute).snapshot.data['title'] as string | undefined) ?? 'Sección';
}
