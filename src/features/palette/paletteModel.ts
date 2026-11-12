import type { ElementCategory, ElementDefinition } from '@/core/types/element';
import { ru } from '@/i18n/ru';

export interface PaletteGroup {
  readonly category: ElementCategory;
  readonly title: string;
  readonly items: readonly ElementDefinition[];
}

/** Группы палитры в порядке первого появления категории в реестре; порядок элементов сохраняется. */
export function groupElements(definitions: readonly ElementDefinition[]): PaletteGroup[] {
  const groups = new Map<ElementCategory, ElementDefinition[]>();
  for (const definition of definitions) {
    const items = groups.get(definition.category) ?? [];
    items.push(definition);
    groups.set(definition.category, items);
  }
  return [...groups].map(([category, items]) => ({ category, title: ru.categories[category], items }));
}
