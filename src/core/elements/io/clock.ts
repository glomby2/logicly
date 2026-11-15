import type { KnownSignal } from '../../logic/signal';
import type { ElementDefinition, ElementPins } from '../../types/element';
import { indexedPins, outputPinId } from '../pins';

export type ClockProps = { readonly halfPeriod: number };
/** Текущий уровень и число шагов, прошедших с последнего переключения. */
export type ClockState = { readonly level: KnownSignal; readonly phase: number };

export const MIN_HALF_PERIOD = 1;
export const MAX_HALF_PERIOD = 16;

const PINS: ElementPins = { inputs: [], outputs: indexedPins(1, outputPinId) };

/**
 * Генератор тактов. Время двигают шаги симуляции (Start / Step); уровень меняется
 * каждые `halfPeriod` шагов, начальный уровень 0. Период — 2 · halfPeriod шагов.
 */
export const CLOCK: ElementDefinition<ClockProps, ClockState> = {
  type: 'CLOCK',
  label: 'CLOCK',
  description: 'Генератор тактов: меняет уровень каждые N шагов симуляции (Старт / Шаг)',
  category: 'io',
  defaultProps: { halfPeriod: MIN_HALF_PERIOD },
  propSchema: [{ key: 'halfPeriod', label: 'Полупериод (тактов)', kind: 'integer', min: MIN_HALF_PERIOD, max: MAX_HALF_PERIOD }],
  pins: () => PINS,
  initialState: () => ({ level: 0, phase: 0 }),
  evaluate: ({ state }) => ({ outputs: [state.level] }),
  onTick: ({ props, state }) => {
    const phase = state.phase + 1;
    if (phase < props.halfPeriod) return { ...state, phase };
    return { level: state.level === 1 ? 0 : 1, phase: 0 };
  },
};
