import { createDefaultRegistry, type ElementRegistry } from '@/core/elements';
import type { EngineOptions } from '@/core/simulation';
import { createCircuitStore, type CircuitStore } from './circuitStore';
import { createCommands, type AppCommands } from './commands';
import { connectSimulation, type SimulationBridge } from './simulationBridge';
import { createSimulationController, type Scheduler, type SimulationController } from './simulationController';
import { createSimulationStore, type SimulationStore } from './simulationStore';
import { createUiStore, type UiStore } from './uiStore';

export interface AppStores {
  readonly registry: ElementRegistry;
  readonly circuit: CircuitStore;
  readonly simulation: SimulationStore;
  readonly ui: UiStore;
  /** Операции над движком: публикует результаты вычислений в simulationStore. */
  readonly simulationBridge: SimulationBridge;
  /** Start / Pause / Step / Reset и таймер. Интерфейс управляет симуляцией через него. */
  readonly simulationController: SimulationController;
  readonly commands: AppCommands;
  dispose(): void;
}

export interface AppStoresOptions {
  readonly registry?: ElementRegistry;
  readonly createId?: (prefix: string) => string;
  readonly engineOptions?: Omit<EngineOptions, 'initialState'>;
  readonly scheduler?: Scheduler;
}

/** Создаёт связанный набор хранилищ. В приложении — один экземпляр, в тестах — свой на каждый тест. */
export function createAppStores({
  registry = createDefaultRegistry(),
  createId,
  engineOptions,
  scheduler,
}: AppStoresOptions = {}): AppStores {
  const circuit = createCircuitStore({ registry, createId });
  const simulation = createSimulationStore();
  const ui = createUiStore();
  // Мост подписывается на схему раньше контроллера: при структурном изменении сначала
  // пересобирается движок, затем контроллер останавливает таймер.
  const simulationBridge = connectSimulation({ circuitStore: circuit, simulationStore: simulation, registry, engineOptions });
  const simulationController = createSimulationController({
    bridge: simulationBridge,
    simulationStore: simulation,
    circuitStore: circuit,
    scheduler,
  });

  // Элементы и провода исчезают только при структурных изменениях (удаление, undo, загрузка).
  const unsubscribeSelection = circuit.subscribe((state, prev) => {
    if (state.structureVersion !== prev.structureVersion) ui.getState().pruneSelection(state.circuit);
  });

  return {
    registry,
    circuit,
    simulation,
    ui,
    simulationBridge,
    simulationController,
    commands: createCommands({ circuit, ui, registry }),
    dispose() {
      simulationController.dispose();
      simulationBridge.dispose();
      unsubscribeSelection();
    },
  };
}
