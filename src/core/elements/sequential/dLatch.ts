import { join, not } from '../../logic/ops';
import { UNKNOWN, type Signal } from '../../logic/signal';
import type { ElementDefinition } from '../../types/element';
import type { NoProps } from '../gates/gate';
import { LATCH_OUTPUTS } from './flipFlop';

export type LatchState = { readonly q: Signal };

const PINS = {
  inputs: [
    { id: 'd', label: 'D' },
    { id: 'e', label: 'E' },
  ],
  outputs: LATCH_OUTPUTS,
};

/**
 * D-защёлка, управляемая уровнем: при E = 1 Q повторяет D (прозрачна), при E = 0 хранит.
 * При E = X Q = join(Q, D). Выходы публикуются на границе дельта-цикла, как у триггеров.
 */
export const D_LATCH: ElementDefinition<NoProps, LatchState> = {
  type: 'D_LATCH',
  label: 'D LATCH',
  description: 'D-защёлка: при E = 1 выход повторяет D, при E = 0 хранит последнее значение',
  category: 'sequential',
  defaultProps: {},
  pins: () => PINS,
  initialState: () => ({ q: 0 }),
  unknownState: () => ({ q: UNKNOWN }),
  evaluate: ({ inputs, state }) => {
    const d = inputs[0] ?? 0;
    const e = inputs[1] ?? 0;
    const q = e === 1 ? d : e === 0 ? state.q : join(state.q, d);
    return { outputs: [q, not(q)], state: { q } };
  },
};
