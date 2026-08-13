import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import type { CategoryNode } from '../../core/models/menu.models';
import { MenuStore } from '../../core/stores/menu.store';
import { pickLocalizedText } from '../../utils/localized-text.utils';
import { ProductCardComponent } from './product-card.component';

/**
 * Se auto-referencia para renderizar el árbol anidado de categorías
 * (`children`) sin necesidad de un tercer componente no pedido por el
 * ticket. `categories` es un `input()` OPCIONAL:
 * - Invocación raíz (sin `[categories]`, ej. desde `MenuLayoutComponent`):
 *   consume `MenuStore.filteredCategoriesTree()` directamente — cumple
 *   literalmente lo pedido ("debe consumir el Signal filteredCategoriesTree
 *   del MenuStore"), y es la única invocación que muestra los estados de
 *   carga/error/vacío (no tendría sentido repetirlos en cada nivel anidado).
 * - Invocaciones recursivas (`[categories]="category.children"`): reciben un
 *   subconjunto ya resuelto del MISMO signal, pasado por props — no hay una
 *   segunda fuente de verdad.
 *
 * Vive en `features/menu-public/` (no en `ui/`), por lo que SÍ puede
 * inyectar un Store (docs/frontend-architecture.md §4.2 — la restricción de
 * "solo presentacional, sin Store" aplica a `ui/*`, no a componentes propios
 * de una feature).
 */
@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-list.component.html',
})
export class CategoryListComponent {
  private readonly menuStore = inject(MenuStore);

  readonly categories = input<readonly CategoryNode[] | null>(null);

  /** `true` solo en la invocación raíz (sin `[categories]`): ahí se muestran los estados de carga/error/vacío. */
  protected readonly isRoot = computed(() => this.categories() === null);

  protected readonly effectiveCategories = computed(
    () => this.categories() ?? this.menuStore.filteredCategoriesTree(),
  );

  protected readonly syncStatus = this.menuStore.syncStatus;
  protected readonly hasMenuData = this.menuStore.hasMenuData;
  protected readonly hasActiveAllergenFilter = this.menuStore.hasActiveAllergenFilter;

  /** Placeholders para el skeleton de carga inicial (sin fabricar datos: solo controla cuántos bloques dibujar). */
  protected readonly skeletonPlaceholders = [0, 1, 2, 3, 4, 5];

  protected categoryName(category: CategoryNode): string {
    return pickLocalizedText(category.name);
  }

  protected categoryDescription(category: CategoryNode): string | null {
    return category.description ? pickLocalizedText(category.description) : null;
  }
}
