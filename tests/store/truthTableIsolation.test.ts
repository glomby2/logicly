import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTruthTable } from '@/core/analysis';
import { createDefaultRegistry } from '@/core/elements';
import { TEST_CLOCK } from '../helpers/fixtureElements';
import { createTestApp, inp, out } from '../helpers/stores';

/*
 * Таблица истинности строится на собственных экземплярах движка: основная схема,
 * хранилища, сигналы, защёлки, время, таймер и история не должны меняться.
 */

function setup() {
  const registry = createDefaultRegistry();
  registry.register(TEST_CLOCK);
  const t = createTestApp({ registry });
  const c = () => t.circuit();
  // RS-защёлка на NOR с индикатором и генератор.
  const s = c().addComponent('INPUT', { x: 0, y: 0 }, {}, 'S');
  const r = c().addComponent('INPUT', { x: 0, y: 100 }, {}, 'R');
  const q = c().addComponent('NOR', { x: 100, y: 0 });
  const qn = c().addComponent('NOR', { x: 100, y: 100 });
  const y = c().addComponent('OUTPUT', { x: 200, y: 0 }, {}, 'Q');
  c().connect(out(r), inp(q, 0));
  c().connect(out(qn), inp(q, 1));
  c().connect(out(s), inp(qn, 0));
  c().connect(out(q), inp(qn, 1));
  c().connect(out(q), inp(y));
  c().addComponent('TEST_CLOCK', { x: 0, y: 300 });
  return { ...t, registry, s, q };
}

function snapshot(t: ReturnType<typeof setup>) {
  const c = t.circuit();
  const s = t.simulation();
  return {
    circuit: c.circuit,
    history: c.history,
    versions: [c.documentVersion, c.structureVersion, c.propsVersion],
    signals: s.signals,
    compilations: s.compilations,
    time: s.time,
    running: s.running,
    engineState: t.app.simulationBridge.getEngine().exportState(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('изоляция таблицы истинности от основной симуляции', () => {
  it('не меняет схему, историю, сигналы, состояние защёлки, время и число компиляций', () => {
    const t = setup();
    // Переводим защёлку в состояние, отличное от состояния после включения.
    const powerUp = t.signal(out(t.q));
    const trigger = powerUp === 1 ? 'R' : 'S';
    const id = t.circuit().circuit.components.find((c) => c.label === trigger)!.id;
    t.app.commands.toggleInput(id);
    t.app.commands.toggleInput(id);
    t.app.simulationController.step();
    const before = snapshot(t);

    const result = buildTruthTable(t.circuit().circuit, t.registry);
    expect(result.ok).toBe(true);

    const after = snapshot(t);
    expect(after.circuit).toBe(before.circuit);
    expect(after.history).toBe(before.history);
    expect(after.signals).toBe(before.signals);
    expect(after).toEqual(before);
    expect(t.signal(out(t.q))).not.toBe(powerUp);
  });

  it('не останавливает и не сдвигает запущенную симуляцию', () => {
    const t = setup();
    t.app.simulationController.start();
    vi.advanceTimersByTime(1000);
    const before = snapshot(t);

    buildTruthTable(t.circuit().circuit, t.registry);
    expect(snapshot(t)).toEqual(before);
    expect(t.app.simulationController.isTimerActive()).toBe(true);

    vi.advanceTimersByTime(500);
    expect(t.simulation().time).toBe(before.time + 1);
    t.app.simulationController.pause();
  });
});
