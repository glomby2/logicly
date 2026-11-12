import type { CircuitStore } from './circuitStore';
import type { SimulationBridge } from './simulationBridge';
import type { SimulationStore } from './simulationStore';

/** Источник периодических вызовов. В приложении — таймеры браузера, в тестах — фиктивные. */
export interface Scheduler {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const browserScheduler: Scheduler = {
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>),
};

/** Start / Pause / Step / Reset. Изменяет simulationStore только через его действия. */
export interface SimulationController {
  /** Запускает периодические шаги. Без элементов времени не делает ничего и возвращает `false`. */
  start(): boolean;
  pause(): void;
  /** Один шаг времени. Во время работы сначала ставит на паузу. */
  step(): void;
  /** Останавливает таймер и возвращает симуляцию к состоянию включения. */
  reset(): void;
  setFrequency(frequency: number): void;
  /** Активен ли таймер (для тестов и диагностики). */
  isTimerActive(): boolean;
  dispose(): void;
}

export interface SimulationControllerOptions {
  readonly bridge: SimulationBridge;
  readonly simulationStore: SimulationStore;
  readonly circuitStore: CircuitStore;
  readonly scheduler?: Scheduler;
}

/**
 * Управляет запуском симуляции во времени. Одновременно активен не больше одного таймера.
 * Таймер останавливается при Pause, Reset, структурном изменении или загрузке схемы,
 * исчезновении элементов времени и `dispose`. Изменения свойств (переключение INPUT)
 * и перемещения элементов работу не прерывают.
 */
export function createSimulationController({
  bridge,
  simulationStore,
  circuitStore,
  scheduler = browserScheduler,
}: SimulationControllerOptions): SimulationController {
  let timer: unknown = null;
  const state = () => simulationStore.getState();

  const stopTimer = () => {
    if (timer === null) return;
    scheduler.clearInterval(timer);
    timer = null;
  };

  /** Перезапуск таймера с текущей частотой; предыдущий таймер всегда снимается. */
  const startTimer = () => {
    stopTimer();
    timer = scheduler.setInterval(() => bridge.step(), 1000 / state().frequency);
  };

  const pause = () => {
    stopTimer();
    state().setRunning(false);
  };

  const unsubscribeCircuit = circuitStore.subscribe((next, prev) => {
    if (next.structureVersion !== prev.structureVersion || next.documentVersion !== prev.documentVersion) pause();
  });

  const unsubscribeSimulation = simulationStore.subscribe((next, prev) => {
    if (prev.hasTimeElements && !next.hasTimeElements) pause();
  });

  return {
    start() {
      if (!state().hasTimeElements) return false;
      if (timer === null) startTimer();
      state().setRunning(true);
      return true;
    },

    pause,

    step() {
      pause();
      bridge.step();
    },

    reset() {
      pause();
      bridge.reset();
    },

    setFrequency(frequency) {
      state().setFrequency(frequency);
      if (timer !== null) startTimer();
    },

    isTimerActive: () => timer !== null,

    dispose() {
      pause();
      unsubscribeCircuit();
      unsubscribeSimulation();
    },
  };
}
