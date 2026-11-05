import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Signal } from '@/core/logic/signal';
import { netIdOf, type CompileDiagnostic, type NetId, type SettleStatus } from '@/core/simulation';
import type { ComponentId, PinRef } from '@/core/types/circuit';

/**
 * Результаты симуляции. Пишет их только мост (`simulationBridge`); схема здесь не хранится.
 * Ключ пина — `componentId:pinId` (формат `netIdOf`).
 */
export interface SimulationStoreState {
  /** Значения всех пинов: выходов и входов (вход — значение питающей сети или 0). */
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
}

export type SimulationStore = StoreApi<SimulationStoreState>;

export const INITIAL_SIMULATION_STATE: SimulationStoreState = {
  signals: {},
  status: 'stable',
  unknownNets: [],
  floatingInputs: new Set(),
  feedbackComponents: new Set(),
  diagnostics: [],
  time: 0,
  evaluations: 0,
  compilations: 0,
};

export function createSimulationStore(): SimulationStore {
  return createStore<SimulationStoreState>()(() => INITIAL_SIMULATION_STATE);
}

/** Значение пина; неизвестный пин — 0. */
export function selectPinSignal(state: SimulationStoreState, ref: PinRef): Signal {
  return state.signals[netIdOf(ref)] ?? 0;
}

export function selectIsFloating(state: SimulationStoreState, ref: PinRef): boolean {
  return state.floatingInputs.has(netIdOf(ref));
}

export const selectHasUnknown = (state: SimulationStoreState) => state.unknownNets.length > 0;
