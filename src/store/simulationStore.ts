import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Signal } from '@/core/logic/signal';
import { netIdOf, type CompileDiagnostic, type NetId, type SettleStatus } from '@/core/simulation';
import type { ComponentId, PinRef } from '@/core/types/circuit';

/** Результаты вычислений. Публикует мост (`simulationBridge`) действием `publish`. */
export interface SimulationResults {
  /** Значения всех пинов, ключ — `componentId:pinId`: выходов и входов (вход — значение питающей сети или 0). */
  readonly signals: Readonly<Record<string, Signal>>;
  readonly status: SettleStatus;
  readonly unknownNets: readonly NetId[];
  /** Неподключённые входы — для визуального выделения. */
  readonly floatingInputs: ReadonlySet<string>;
  readonly feedbackComponents: ReadonlySet<ComponentId>;
  readonly diagnostics: readonly CompileDiagnostic[];
  readonly time: number;
  /** Число вычислений элементов в последнем расчёте. */
  readonly evaluations: number;
  /** Число компиляций netlist с момента запуска — для диагностики и тестов. */
  readonly compilations: number;
  /** Есть ли в схеме элементы, зависящие от времени (`onTick`), — только тогда доступны Start и Pause. */
  readonly hasTimeElements: boolean;
}

/** Состояние запуска. Управляет контроллер (`simulationController`). */
export interface SimulationRunState {
  readonly running: boolean;
  /** Частота шагов времени, тиков в секунду. */
  readonly frequency: number;
}

export interface SimulationStoreState extends SimulationResults, SimulationRunState {
  publish(results: Partial<SimulationResults>): void;
  setRunning(running: boolean): void;
  /** Частота ограничивается диапазоном [MIN_FREQUENCY, MAX_FREQUENCY]. */
  setFrequency(frequency: number): void;
}

export type SimulationStore = StoreApi<SimulationStoreState>;

export const MIN_FREQUENCY = 0.5;
export const MAX_FREQUENCY = 20;
export const DEFAULT_FREQUENCY = 2;
/** Значения частоты, предлагаемые в интерфейсе. */
export const FREQUENCY_PRESETS: readonly number[] = [0.5, 1, 2, 5, 10, 20];

export const INITIAL_SIMULATION_RESULTS: SimulationResults = {
  signals: {},
  status: 'stable',
  unknownNets: [],
  floatingInputs: new Set(),
  feedbackComponents: new Set(),
  diagnostics: [],
  time: 0,
  evaluations: 0,
  compilations: 0,
  hasTimeElements: false,
};

export function createSimulationStore(): SimulationStore {
  return createStore<SimulationStoreState>()((set, get) => ({
    ...INITIAL_SIMULATION_RESULTS,
    running: false,
    frequency: DEFAULT_FREQUENCY,

    publish: (results) => set(results),

    setRunning(running) {
      if (get().running !== running) set({ running });
    },

    setFrequency(frequency) {
      const clamped = Math.min(MAX_FREQUENCY, Math.max(MIN_FREQUENCY, Number.isFinite(frequency) ? frequency : DEFAULT_FREQUENCY));
      if (get().frequency !== clamped) set({ frequency: clamped });
    },
  }));
}

/** Значение пина; неизвестный пин — 0. */
export function selectPinSignal(state: SimulationStoreState, ref: PinRef): Signal {
  return state.signals[netIdOf(ref)] ?? 0;
}

export function selectIsFloating(state: SimulationStoreState, ref: PinRef): boolean {
  return state.floatingInputs.has(netIdOf(ref));
}

export const selectHasUnknown = (state: SimulationStoreState) => state.unknownNets.length > 0;
