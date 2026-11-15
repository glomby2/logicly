import type { NoProps } from '@/core/elements';
import { join, not } from '@/core/logic/ops';
import type { KnownSignal, Signal } from '@/core/logic/signal';
import type { ElementDefinition } from '@/core/types/element';

/*
 * Тестовые элементы с состоянием. Это не реализация будущих CLOCK и D FLIP-FLOP,
 * а проверка того, что архитектура движка их поддерживает.
 */

type ClockProps = { readonly halfPeriod: number };
type ClockState = { readonly level: KnownSignal; readonly phase: number };

/** Генератор: меняет уровень каждые `halfPeriod` тиков. */
export const TEST_CLOCK: ElementDefinition<ClockProps, ClockState> = {
  type: 'TEST_CLOCK',
  label: 'CLOCK',
  description: 'Тестовый генератор тактов',
  category: 'io',
  defaultProps: { halfPeriod: 1 },
  pins: () => ({ inputs: [], outputs: [{ id: 'out0' }] }),
  initialState: () => ({ level: 0, phase: 0 }),
  evaluate: ({ state }) => ({ outputs: [state.level] }),
  onTick: ({ props, state }) => {
    const phase = state.phase + 1;
    if (phase < props.halfPeriod) return { ...state, phase };
    return { level: state.level === 1 ? 0 : 1, phase: 0 };
  },
};

/** `clk: null` — такт ещё не наблюдался (включение или новый элемент): фронта нет. */
type DffState = { readonly q: Signal; readonly clk: Signal | null };

/**
 * D-триггер по переднему фронту. Если фронт возможен, но не достоверен (X на CLK сейчас
 * или раньше), Q = join(Q, D). Таблица выбрана так, чтобы `evaluate` был монотонен по X
 * и идемпотентен: повторное вычисление с теми же входами не меняет выходы.
 *
 * Первое вычисление после включения только запоминает уровень CLK (фронта нет); если
 * уровень X — такт по-прежнему считается не наблюдавшимся (иначе повтор дал бы фронт).
 */
export const TEST_DFF: ElementDefinition<NoProps, DffState> = {
  type: 'TEST_DFF',
  label: 'D FLIP-FLOP',
  description: 'Тестовый D-триггер',
  category: 'sequential',
  defaultProps: {},
  pins: () => ({
    inputs: [
      { id: 'd', label: 'D' },
      { id: 'clk', label: 'CLK' },
    ],
    outputs: [
      { id: 'q', label: 'Q' },
      { id: 'qn', label: 'Q̄' },
    ],
  }),
  initialState: () => ({ q: 0, clk: null }),
  evaluate: ({ inputs, state }) => {
    const d = inputs[0] ?? 0;
    const clk = inputs[1] ?? 0;
    const noEdge = state.clk === null || clk === 0 || (state.clk === 1 && clk === 1);
    const rising = state.clk === 0 && clk === 1;
    const q = noEdge ? state.q : rising ? d : join(state.q, d);
    return { outputs: [q, not(q)], state: { q, clk: state.clk === null && clk === 'X' ? null : clk } };
  },
};
