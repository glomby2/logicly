import type { ElementRegistry } from '@/core/elements';
import {
  compileCircuit,
  findFloatingInputs,
  netIdOf,
  SimulationEngine,
  type EngineOptions,
  type SettleResult,
} from '@/core/simulation';
import type { Circuit } from '@/core/types/circuit';
import type { CircuitStore } from './circuitStore';
import type { SimulationStore, SimulationStoreState } from './simulationStore';

/** Управление симуляцией. Start/Pause (таймер вокруг `step`) добавляются на уровне интерфейса. */
export interface SimulationBridge {
  /** Один шаг времени (Step): `onTick` у элементов времени и пересчёт. */
  step(): void;
  /** Состояние включения (Reset): сети 0, начальные состояния, время 0. */
  reset(): void;
  getEngine(): SimulationEngine;
  dispose(): void;
}

export interface SimulationBridgeOptions {
  readonly circuitStore: CircuitStore;
  readonly simulationStore: SimulationStore;
  readonly registry: ElementRegistry;
  readonly engineOptions?: Omit<EngineOptions, 'initialState'>;
}

/**
 * Связывает схему с движком по версиям `circuitStore`:
 * - `documentVersion` — новый движок с состояния включения;
 * - `structureVersion` — перекомпиляция с переносом состояния (`exportState`), поэтому
 *   защёлки не сбрасываются при правке схемы;
 * - `propsVersion` — `engine.setProps()` для изменённых элементов и инкрементальный пересчёт.
 * Перемещение и переименование не меняют версий и не затрагивают симуляцию.
 */
export function connectSimulation({
  circuitStore,
  simulationStore,
  registry,
  engineOptions,
}: SimulationBridgeOptions): SimulationBridge {
  let engine!: SimulationEngine;
  let compilations = 0;

  const publish = (result: SettleResult, extra: Partial<SimulationStoreState> = {}) => {
    simulationStore.setState({
      ...extra,
      signals: engine.getPinSignals(),
      status: result.status,
      unknownNets: result.unknownNets,
      time: engine.time,
      evaluations: result.evaluations,
      compilations,
    });
  };

  const rebuild = (preserveState: boolean) => {
    const netlist = compileCircuit(circuitStore.getState().circuit, registry);
    const initialState = preserveState && engine ? engine.exportState() : undefined;
    engine = new SimulationEngine(netlist, { ...engineOptions, initialState });
    compilations++;
    publish(engine.settle(), {
      floatingInputs: new Set(findFloatingInputs(netlist).map(netIdOf)),
      feedbackComponents: netlist.feedbackComponents,
      diagnostics: netlist.diagnostics,
    });
  };

  const applyProps = (prev: Circuit, next: Circuit) => {
    const previousProps = new Map(prev.components.map((c) => [c.id, c.props]));
    try {
      for (const component of next.components) {
        if (previousProps.get(component.id) === component.props) continue;
        if (engine.netlist.componentIndex.has(component.id)) engine.setProps(component.id, component.props);
      }
    } catch {
      // Изменился набор пинов, хотя версия структуры не менялась — надёжнее перекомпилировать.
      rebuild(true);
      return;
    }
    publish(engine.settle());
  };

  rebuild(false);

  const unsubscribe = circuitStore.subscribe((state, prev) => {
    if (state.documentVersion !== prev.documentVersion) rebuild(false);
    else if (state.structureVersion !== prev.structureVersion) rebuild(true);
    else if (state.propsVersion !== prev.propsVersion) applyProps(prev.circuit, state.circuit);
  });

  return {
    step: () => publish(engine.tick()),
    reset() {
      engine.reset();
      publish(engine.settle());
    },
    getEngine: () => engine,
    dispose: unsubscribe,
  };
}
