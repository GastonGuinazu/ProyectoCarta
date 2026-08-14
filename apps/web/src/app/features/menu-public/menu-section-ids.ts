export const MENU_HAPPY_HOUR_SECTION_ID = 'menu-happy-hour';
export const MENU_COMBOS_SECTION_ID = 'menu-combos';
/** Respiro extra bajo el chrome sticky al saltar a una sección. */
export const MENU_STICKY_SCROLL_GAP_PX = 12;

export function menuCategorySectionId(categoryId: string): string {
  return `menu-category-${categoryId}`;
}
