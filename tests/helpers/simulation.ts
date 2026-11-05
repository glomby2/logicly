import { expect } from 'vitest';
import { createDefaultRegistry, type ElementRegistry } from '@/core/elements';
import type { Signal } from '@/core/logic/signal';
import { compileCircuit, SimulationEngine, type EngineOptions, type SettleResult } from '@/core/simulation';
import type { Circuit } from '@/core/types/circuit';
import { pin } from './circuitBuilder';

export function simulate(circuit: Circuit, registry: ElementRegistry = createDefaultRegistry(), options?: EngineOptions) {
  const netlist = compileCircuit(circuit, registry);
  const engine = new SimulationEngine(netlist, options);
  const result = engine.settle();
  return { netlist, engine, result };
}

export function setInput(engine: SimulationEngine, id: string, value: boolean | 0 | 1): SettleResult {
  engine.setProps(id, { value: Boolean(value) });
  return engine.settle();
}

/** Значение элемента: выход `out0`, а для OUTPUT — его вход. Можно указать пин явно: `'G.in1'`. */
export function read(engine: SimulationEngine, spec: string): Signal {
  const value = engine.getPinValue(pin(spec, 'out0')) ?? engine.getPinValue(pin(spec, 'in0'));
  if (value === undefined) throw new Error(`Пин "${spec}" не найден`);
  return value;
}

/** Инвариант после settle(): каждый элемент выдаёт ровно то, что вычисляется из его входов. */
export function expectFixpoint(engine: SimulationEngine): void {
  const { componentStates } = engine.exportState();
  for (const component of engine.netlist.components) {
    const at = (pinId: string) => engine.getPinValue({ componentId: component.id, pinId })!;
    const inputs = component.inputPins.map((p) => at(p.id));
    const expected = component.definition.evaluate({
      inputs,
      props: engine.getProps(component.id),
      state: componentStates[component.id],
    }).outputs;
    expect(component.outputPins.map((p) => at(p.id)), `элемент ${component.id}`).toEqual(expected);
  }
}

/** Детерминированный генератор псевдослучайных чисел (mulberry32). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
