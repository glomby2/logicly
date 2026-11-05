import { fromBoolean } from '../../logic/signal';
import type { ElementDefinition, ElementPins } from '../../types/element';
import { indexedPins, outputPinId } from '../pins';

export type InputProps = { readonly value: boolean };

const PINS: ElementPins = { inputs: [], outputs: indexedPins(1, outputPinId) };

export const INPUT: ElementDefinition<InputProps> = {
  type: 'INPUT',
  label: 'INPUT',
  description: 'Переключатель: подаёт на выход 0 или 1',
  category: 'io',
  defaultProps: { value: false },
  interactiveProps: ['value'],
  pins: () => PINS,
  evaluate: ({ props }) => ({ outputs: [fromBoolean(props.value)] }),
};
