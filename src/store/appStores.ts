import { createDefaultRegistry, type ElementRegistry } from '@/core/elements';
import type { EngineOptions } from '@/core/simulation';
import { createCircuitStore, type CircuitStore } from './circuitStore';
import { createCommands, type AppCommands } from './commands';
import { connectSimulation, type SimulationBridge } from './simulationBridge';
import { createSimulationStore, type SimulationStore } from './simulationStore';
import { createUiStore, type UiStore } from './uiStore';

export interface AppStores {
  readonly registry: ElementRegistry;
  readonly circuit: CircuitStore;
  readonly simulation: SimulationStore;
  readonly ui: UiStore;
  readonly simulationControl: SimulationBridge;
  readonly commands: AppCommands;
  dispose(): void;
}

export interface AppStoresOptions {
  readonly registry?: ElementRegistry;
  readonly createId?: (prefix: string) => string;
  readonly engineOptions?: Omit<EngineOptions, 'initialState'>;
}

/** Создаёт связанный набор хранилищ. В приложении — один экземпляр, в тестах — свой на каждый тест. */
export function createAppStores({
  registry = createDefaultRegistry(),
  createId,
  engineOptions,
}: AppStoresOptions = {}): AppStores {
  const circuit = createCircuitStore({ registry, createId });
  const simulation = createSimulationStore();
  const ui = createUiStore();
  const simulationControl = connectSimulation({ circuitStore: circuit, simulationStore: simulation, registry, engineOptions });

  // Элементы и провода исчезают только при структурных изменениях (удаление, undo, загрузка).
  const unsubscribeSelection = circuit.subscribe((state, prev) => {
    if (state.structureVersion !== prev.structureVersion) ui.getState().pruneSelection(state.circuit);
  });

  return {
    registry,
    circuit,
    simulation,
    ui,
    simulationControl,
    commands: createCommands({ circuit, ui }),
    dispose() {
      simulationControl.dispose();
      unsubscribeSelection();
    },
  };
}
