import type { ElementDefinition, ElementPins } from '../../types/element';
import type { NoProps } from '../gates/gate';
import { indexedPins, inputPinId } from '../pins';

const PINS: ElementPins = { inputs: indexedPins(1, inputPinId), outputs: [] };

/** Индикатор. Выходов нет: отображаемое значение — сигнал на его входе. */
export const OUTPUT: ElementDefinition<NoProps> = {
  type: 'OUTPUT',
  label: 'OUTPUT',
  description: 'Индикатор: светится, когда на входе 1',
  category: 'io',
  defaultProps: {},
  labelPrefix: 'Y',
  port: { kind: 'output' },
  pins: () => PINS,
  evaluate: () => ({ outputs: [] }),
};
