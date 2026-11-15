import { xor } from '../../logic/ops';
import { CLOCK_PIN, defineFlipFlop } from './flipFlop';

/** T-триггер: по переднему фронту CLK при T = 1 Q меняется на противоположное, при T = 0 хранится. */
export const T_FLIP_FLOP = defineFlipFlop({
  type: 'T_FLIP_FLOP',
  label: 'T FLIP-FLOP',
  description: 'T-триггер: по переднему фронту CLK при T = 1 меняет состояние, при T = 0 хранит',
  inputs: [{ id: 't', label: 'T' }, CLOCK_PIN],
  // Q ⊕ T; X на T или Q даёт X — это и есть точное значение (Q или Q̄).
  next: ([t], q) => xor([t!, q]),
});
