import { netIdOf } from '@/core/simulation';
import type { Signal } from '@/core/logic/signal';
import type { PinRef } from '@/core/types/circuit';
import { createAppStores, type AppStoresOptions } from '@/store';

/** Детерминированные id: `prefix-1`, `prefix-2`, … */
export function sequentialIds(): (prefix: string) => string {
  let counter = 0;
  return (prefix) => `${prefix}-${++counter}`;
}

export const out = (componentId: string, index = 0): PinRef => ({ componentId, pinId: `out${index}` });
export const inp = (componentId: string, index = 0): PinRef => ({ componentId, pinId: `in${index}` });

export function createTestApp(options: AppStoresOptions = {}) {
  const app = createAppStores({ createId: sequentialIds(), ...options });
  const circuit = () => app.circuit.getState();
  const simulation = () => app.simulation.getState();
  const signal = (ref: PinRef): Signal | undefined => simulation().signals[netIdOf(ref)];
  return { app, circuit, simulation, signal };
}
