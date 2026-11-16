import { fromBoolean } from '../../logic/signal';
import type { ElementDefinition, ElementPins } from '../../types/element';
import { indexedPins, outputPinId } from '../pins';

export type ConstantProps = { readonly level: boolean };

const PINS: ElementPins = { inputs: [], outputs: indexedPins(1, outputPinId) };

/**
 * Постоянный логический уровень. Роли `port` нет: в таблице истинности это внутренний
 * источник, а не столбец входа, и по клику уровень не переключается. Уровень — обычное
 * (не интерактивное) свойство: меняется в инспекторе и попадает в историю.
 * Свойство намеренно не `value`: так элемент не похож на INPUT ни по роли, ни по имени.
 */
export const CONSTANT: ElementDefinition<ConstantProps> = {
  type: 'CONSTANT',
  label: 'CONSTANT',
  description: 'Постоянный логический уровень 0 или 1. В таблице истинности не является входом схемы',
  category: 'io',
  defaultProps: { level: true },
  propSchema: [{ key: 'level', label: 'Логическая 1', kind: 'boolean' }],
  pins: () => PINS,
  variant: ({ level }) => (level ? '1' : '0'),
  evaluate: ({ props }) => ({ outputs: [fromBoolean(props.level)] }),
};
