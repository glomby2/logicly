import { useStore } from 'zustand';
import { createAppStores } from './appStores';
import type { CircuitStoreState } from './circuitStore';
import type { SimulationStoreState } from './simulationStore';
import type { UiStoreState } from './uiStore';

/** Экземпляр хранилищ приложения. Тесты создают собственные через `createAppStores()`. */
export const appStores = createAppStores();

export const useCircuitStore = <T>(selector: (state: CircuitStoreState) => T): T =>
  useStore(appStores.circuit, selector);

export const useSimulationStore = <T>(selector: (state: SimulationStoreState) => T): T =>
  useStore(appStores.simulation, selector);

export const useUiStore = <T>(selector: (state: UiStoreState) => T): T => useStore(appStores.ui, selector);
