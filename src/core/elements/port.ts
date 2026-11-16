import type { ElementDefinition } from '../types/element';

/**
 * Свойство, которое пользователь переключает кликом, — у элемента с ролью внешнего входа
 * (`port.kind === 'input'`, INPUT: `value`). У остальных элементов `undefined`, даже если у них
 * есть логическое свойство: CONSTANT меняется в инспекторе как обычное свойство.
 */
export function switchProp(definition: ElementDefinition | undefined): string | undefined {
  return definition?.port?.kind === 'input' ? definition.port.prop : undefined;
}
