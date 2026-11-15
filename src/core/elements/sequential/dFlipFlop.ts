import { CLOCK_PIN, defineFlipFlop } from './flipFlop';

/** D-триггер: по переднему фронту CLK Q = D. */
export const D_FLIP_FLOP = defineFlipFlop({
  type: 'D_FLIP_FLOP',
  label: 'D FLIP-FLOP',
  description: 'D-триггер: по переднему фронту CLK запоминает значение D',
  inputs: [{ id: 'd', label: 'D' }, CLOCK_PIN],
  next: ([d]) => d!,
});
