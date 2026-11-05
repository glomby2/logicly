import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { compileCircuit, SimulationEngine } from '@/core/simulation';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import { enabledRingOscillator } from '../../helpers/circuits';
import { TEST_CLOCK, TEST_DFF } from '../../helpers/fixtureElements';
import { expectFixpoint, read, setInput, simulate } from '../../helpers/simulation';

function registryWithFixtures() {
  const registry = createDefaultRegistry();
  registry.register(TEST_CLOCK);
  registry.register(TEST_DFF);
  return registry;
}

/** T-триггер: D-триггер с Q̄ → D, тактируемый генератором. */
function toggleFlipFlop(halfPeriod = 1) {
  return new CircuitBuilder()
    .add('CLK', 'TEST_CLOCK', { halfPeriod })
    .add('FF', 'TEST_DFF')
    .output('L')
    .wire('CLK', 'FF.clk')
    .wire('FF.qn', 'FF.d')
    .wire('FF.q', 'L');
}

describe('время и элементы с onTick', () => {
  it('tick() увеличивает время и переключает генератор', () => {
    const { engine } = simulate(new CircuitBuilder().add('CLK', 'TEST_CLOCK').build(), registryWithFixtures());
    const levels = [read(engine, 'CLK')];
    for (let i = 0; i < 4; i++) {
      expect(engine.tick().status).toBe('stable');
      levels.push(read(engine, 'CLK'));
    }
    expect(engine.time).toBe(4);
    expect(levels).toEqual([0, 1, 0, 1, 0]);
  });

  it('период генератора задаётся свойствами', () => {
    const circuit = new CircuitBuilder().add('CLK', 'TEST_CLOCK', { halfPeriod: 3 }).build();
    const { engine } = simulate(circuit, registryWithFixtures());
    const levels = Array.from({ length: 7 }, () => (engine.tick(), read(engine, 'CLK')));
    expect(levels).toEqual([0, 0, 1, 1, 1, 0, 0]);
  });

  it('схема без элементов времени при tick() не пересчитывается', () => {
    const { engine } = simulate(new CircuitBuilder().input('A').gate('N', 'NOT').wire('A', 'N').build());
    expect(engine.tick().evaluations).toBe(0);
    expect(engine.time).toBe(1);
  });
});

describe('элементы с внутренним состоянием', () => {
  it('D-триггер с обратной связью Q̄ → D переключается ровно один раз на каждый передний фронт', () => {
    const { engine } = simulate(toggleFlipFlop().build(), registryWithFixtures());
    const outputs = Array.from({ length: 6 }, () => (engine.tick(), read(engine, 'L')));
    // Фронты на тиках 1, 3, 5.
    expect(outputs).toEqual([1, 1, 0, 0, 1, 1]);
    expectFixpoint(engine);
  });

  it('D-триггер захватывает D только по фронту', () => {
    const circuit = new CircuitBuilder()
      .input('D')
      .input('C')
      .add('FF', 'TEST_DFF')
      .wire('D', 'FF.d')
      .wire('C', 'FF.clk')
      .build();
    const { engine } = simulate(circuit, registryWithFixtures());
    const q = () => read(engine, 'FF.q');

    setInput(engine, 'D', 1);
    expect(q()).toBe(0);
    setInput(engine, 'C', 1);
    expect(q()).toBe(1);
    setInput(engine, 'D', 0);
    expect(q()).toBe(1);
    setInput(engine, 'C', 0);
    expect(q()).toBe(1);
    setInput(engine, 'C', 1);
    expect(q()).toBe(0);
  });

  it('reset() возвращает время и состояния к начальным', () => {
    const { engine } = simulate(toggleFlipFlop().build(), registryWithFixtures());
    engine.tick();
    expect(read(engine, 'L')).toBe(1);
    engine.reset();
    engine.settle();
    expect(engine.time).toBe(0);
    expect([read(engine, 'CLK'), read(engine, 'L')]).toEqual([0, 0]);
  });

  it('exportState переносит время и состояние элементов в новый движок', () => {
    const registry = registryWithFixtures();
    const circuit = toggleFlipFlop().build();
    const { engine } = simulate(circuit, registry);
    engine.tick();
    engine.tick();
    engine.tick();
    const before = read(engine, 'L');

    const next = new SimulationEngine(compileCircuit(circuit, registry), { initialState: engine.exportState() });
    next.settle();
    expect(next.time).toBe(3);
    expect(read(next, 'L')).toBe(before);
    next.tick();
    engine.tick();
    expect(read(next, 'L')).toBe(read(engine, 'L'));
  });

  it('нестабильный сигнал на тактовом входе не приводит к зависанию', () => {
    const circuit = enabledRingOscillator()
      .add('FF', 'TEST_DFF')
      .wire('N1', 'FF.clk')
      .wire('FF.qn', 'FF.d')
      .build();
    const { engine } = simulate(circuit, registryWithFixtures());
    const result = setInput(engine, 'EN', 1);
    expect(result.status).toBe('oscillation');
    // Число фронтов неизвестно — состояние T-триггера честно неопределённо.
    expect([read(engine, 'FF.q'), read(engine, 'FF.qn')]).toEqual(['X', 'X']);
    expectFixpoint(engine);
  });
});
