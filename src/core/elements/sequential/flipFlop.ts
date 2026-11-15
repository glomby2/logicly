import { not } from '../../logic/ops';
import { UNKNOWN, type Signal } from '../../logic/signal';
import type { ElementDefinition, PinSpec } from '../../types/element';
import type { NoProps } from '../gates/gate';
import { clockEdge, clockedValue, rememberClock, type ClockMemory } from './edge';

export type FlipFlopState = { readonly q: Signal; readonly clk: ClockMemory };

/** Тактовый вход: id `clk`, значок ▷ на символе. */
export const CLOCK_PIN: PinSpec = { id: 'clk', label: 'CLK', clock: true };

/** Выходы Q и Q̄ (порядок важен: Q — первый). */
export const LATCH_OUTPUTS: readonly PinSpec[] = [
  { id: 'q', label: 'Q' },
  { id: 'qn', label: 'Q̄' },
];

interface FlipFlopConfig {
  readonly type: string;
  readonly label: string;
  readonly description: string;
  /** Входы сверху вниз, включая `CLOCK_PIN`. */
  readonly inputs: readonly PinSpec[];
  /** Следующее значение Q по фронту: входы данных (без такта, в порядке `inputs`) и текущее Q. */
  readonly next: (data: readonly Signal[], q: Signal) => Signal;
}

/**
 * Триггер по переднему фронту с выходами Q и Q̄. При включении Q = 0, такт не наблюдался;
 * без фронта Q хранится, по фронту становится `next`, при возможном фронте — `join(Q, next)`.
 */
export function defineFlipFlop({ type, label, description, inputs, next }: FlipFlopConfig): ElementDefinition<NoProps, FlipFlopState> {
  const clockIndex = inputs.findIndex((pin) => pin.clock);
  if (clockIndex < 0) throw new Error(`У триггера ${type} нет тактового входа`);
  const pins = { inputs, outputs: LATCH_OUTPUTS };

  return {
    type,
    label,
    description,
    category: 'sequential',
    defaultProps: {},
    pins: () => pins,
    initialState: () => ({ q: 0, clk: null }),
    unknownState: () => ({ q: UNKNOWN, clk: UNKNOWN }),
    evaluate: ({ inputs: values, state }) => {
      const clk = values[clockIndex] ?? 0;
      const data = inputs.map((_, i) => values[i] ?? 0).filter((_, i) => i !== clockIndex);
      const q = clockedValue(clockEdge(state.clk, clk), state.q, next(data, state.q));
      return { outputs: [q, not(q)], state: { q, clk: rememberClock(state.clk, clk) } };
    },
  };
}
