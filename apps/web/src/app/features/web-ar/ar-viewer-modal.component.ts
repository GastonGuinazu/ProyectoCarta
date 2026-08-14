import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  HostListener,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import '@google/model-viewer';

/**
 * Visor WebAR aislado (docs/frontend-architecture.md §4.3): `@google/model-viewer`
 * vive SOLO en este chunk. `menu-public` lo carga con `import()` al tocar
 * "Ver en tu mesa (AR)", nunca en el bundle inicial del menú.
 *
 * `src` debe ser glTF/GLB para el canvas 3D. USDZ solo sirve en iOS Quick Look
 * (`ios-src`); Chrome lo deja en negro si se pasa como `src`.
 */
@Component({
  selector: 'app-ar-viewer-modal',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ar-viewer-modal.component.html',
})
export class ArViewerModalComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);

  readonly src = input.required<string>();
  readonly productName = input.required<string>();
  readonly poster = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly loadFailed = signal(false);

  protected readonly isUsdz = computed(() => isUsdzUrl(this.src()));
  protected readonly canPreviewInBrowser = computed(() => !this.isUsdz());
  protected readonly iosSrc = computed(() => (this.isUsdz() ? this.src() : null));

  constructor() {
    this.document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  protected onModelError(): void {
    this.loadFailed.set(true);
  }
}

function isUsdzUrl(url: string): boolean {
  try {
    const path = new URL(url, 'http://local').pathname.toLowerCase();
    return path.endsWith('.usdz');
  } catch {
    return url.toLowerCase().includes('.usdz');
  }
}
