export const MENU_HAPPY_HOUR_SECTION_ID = 'menu-happy-hour';
export const MENU_COMBOS_SECTION_ID = 'menu-combos';

export function menuCategorySectionId(categoryId: string): string {
  return `menu-category-${categoryId}`;
}
