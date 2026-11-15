import { describe, expect, it } from 'vitest';
import type { PinRef } from '@/core/types/circuit';
import { createTestApp, out } from '../helpers/stores';

/*
 * MUX и DEMUX в хранилищах и мосте симуляции: смена разрядности — структурное изменение
 * (перекомпиляция, шаг истории, удаление проводов исчезнувших пинов), переключение входов
 * выбора — инкрементальный пересчёт, состояние защёлки переживает перекомпиляцию.
 */

const pin = (componentId: string, pinId: string): PinRef => ({ componentId, pinId });

function setup() {
  const t = createTestApp();
  const c = () => t.circuit();
  const wireIds = () => c().circuit.wires.map((w) => `${w.from.componentId}.${w.from.pinId}→${w.to.componentId}.${w.to.pinId}`);
  const props = (id: string) => c().circuit.components.find((x) => x.id === id)!.props;
  return { ...t, c, wireIds, props };
}

describe('MUX: смена разрядности', () => {
  function mux4() {
    const t = setup();
    const inputs = ['d0', 'd1', 'd2', 'd3', 's0', 's1'].map((p) => [p, t.c().addComponent('INPUT', { x: 0, y: 0 }, {}, p)] as const);
    const m = t.c().addComponent('MUX', { x: 100, y: 0 }, { selectBits: 2 });
    for (const [pinId, id] of inputs) t.c().connect(out(id), pin(m, pinId));
    const ids = Object.fromEntries(inputs);
    return { ...t, m, ids };
  }

  it('4:1 → 2:1: провода на d2, d3, s1 удаляются; перекомпиляция и шаг истории; undo восстанавливает', () => {
    const t = mux4();
    // D3 = 1, адрес 3 → Y = 1.
    for (const p of ['d3', 's0', 's1']) t.app.commands.toggleInput(t.ids[p]!);
    expect(t.signal(pin(t.m, 'y'))).toBe(1);
    const before = { wires: t.wireIds(), structure: t.c().structureVersion, past: t.c().history.past.length };
    const compilations = t.simulation().compilations;

    t.c().updateProps(t.m, { selectBits: 1 });
    expect(t.props(t.m)).toEqual({ selectBits: 1 });
    expect(t.wireIds().map((w) => w.split('→')[1])).toEqual([`${t.m}.d0`, `${t.m}.d1`, `${t.m}.s0`]);
    expect(t.c().structureVersion).toBe(before.structure + 1);
    expect(t.c().history.past).toHaveLength(before.past + 1);
    expect(t.simulation().compilations).toBe(compilations + 1);
    // Адрес S0 = 1 → D1 = 0.
    expect(t.signal(pin(t.m, 'y'))).toBe(0);

    t.c().undo();
    expect(t.props(t.m)).toEqual({ selectBits: 2 });
    expect(t.wireIds()).toEqual(before.wires);
    expect(t.signal(pin(t.m, 'y'))).toBe(1);

    t.c().redo();
    expect(t.props(t.m)).toEqual({ selectBits: 1 });
    expect(t.wireIds()).toHaveLength(3);
  });

  it('2:1 → 8:1: провода на d0, d1, s0 сохраняются', () => {
    const t = setup();
    const a = t.c().addComponent('INPUT', { x: 0, y: 0 }, { value: true });
    const s = t.c().addComponent('INPUT', { x: 0, y: 0 }, { value: true });
    const m = t.c().addComponent('MUX', { x: 100, y: 0 });
    t.c().connect(out(a), pin(m, 'd1'));
    t.c().connect(out(s), pin(m, 's0'));
    expect(t.signal(pin(m, 'y'))).toBe(1);

    t.c().updateProps(m, { selectBits: 3 });
    expect(t.wireIds()).toEqual([`${a}.out0→${m}.d1`, `${s}.out0→${m}.s0`]);
    // s1, s2 не подключены (0): адрес по-прежнему 1.
    expect(t.signal(pin(m, 'y'))).toBe(1);
  });

  it('переключение входа выбора пересчитывается без перекомпиляции', () => {
    const t = mux4();
    t.app.commands.toggleInput(t.ids.d2!);
    const compilations = t.simulation().compilations;
    const past = t.c().history.past.length;

    t.app.commands.toggleInput(t.ids.s1!);
    expect(t.signal(pin(t.m, 'y'))).toBe(1);
    t.app.commands.toggleInput(t.ids.s0!);
    expect(t.signal(pin(t.m, 'y'))).toBe(0);
    expect(t.simulation().compilations).toBe(compilations);
    expect(t.c().history.past).toHaveLength(past);
  });
});

describe('DEMUX: смена разрядности', () => {
  it('1:4 → 1:2: провода с выходов y2, y3 удаляются; undo восстанавливает выходы и провода', () => {
    const t = setup();
    const d = t.c().addComponent('INPUT', { x: 0, y: 0 }, { value: true });
    const s1 = t.c().addComponent('INPUT', { x: 0, y: 0 }, { value: true });
    const x = t.c().addComponent('DEMUX', { x: 100, y: 0 }, { selectBits: 2 });
    t.c().connect(out(d), pin(x, 'd'));
    t.c().connect(out(s1), pin(x, 's1'));
    const leds = [0, 1, 2, 3].map((i) => {
      const led = t.c().addComponent('OUTPUT', { x: 200, y: i * 40 });
      t.c().connect(pin(x, `y${i}`), pin(led, 'in0'));
      return led;
    });
    // Адрес 2 (S1 = 1): D на Y2.
    expect([0, 1, 2, 3].map((i) => t.signal(pin(x, `y${i}`)))).toEqual([0, 0, 1, 0]);
    const before = t.wireIds();

    t.c().updateProps(x, { selectBits: 1 });
    expect(t.wireIds()).toEqual([`${d}.out0→${x}.d`, `${x}.y0→${leds[0]}.in0`, `${x}.y1→${leds[1]}.in0`]);
    expect([0, 1].map((i) => t.signal(pin(x, `y${i}`)))).toEqual([1, 0]);
    expect(t.signal(pin(x, 'y2'))).toBeUndefined();

    t.c().undo();
    expect(t.wireIds()).toEqual(before);
    expect([0, 1, 2, 3].map((i) => t.signal(pin(x, `y${i}`)))).toEqual([0, 0, 1, 0]);
  });
});

describe('D-защёлка на MUX', () => {
  it('хранит значение и сохраняет его при перекомпиляции соседней части схемы', () => {
    const t = setup();
    const d = t.c().addComponent('INPUT', { x: 0, y: 0 });
    const e = t.c().addComponent('INPUT', { x: 0, y: 0 });
    const m = t.c().addComponent('MUX', { x: 100, y: 0 });
    t.c().connect(pin(m, 'y'), pin(m, 'd0'));
    t.c().connect(out(d), pin(m, 'd1'));
    t.c().connect(out(e), pin(m, 's0'));
    expect(t.signal(pin(m, 'y'))).toBe(0);

    // E = 1, D = 1 → Q = 1; E = 0 → хранение; D = 0 не влияет.
    t.app.commands.toggleInput(e);
    t.app.commands.toggleInput(d);
    expect(t.signal(pin(m, 'y'))).toBe(1);
    t.app.commands.toggleInput(e);
    t.app.commands.toggleInput(d);
    expect(t.signal(pin(m, 'y'))).toBe(1);

    const compilations = t.simulation().compilations;
    t.c().addComponent('AND', { x: 300, y: 300 });
    expect(t.simulation().compilations).toBe(compilations + 1);
    expect(t.signal(pin(m, 'y'))).toBe(1);
    expect(t.simulation().status).toBe('stable');
  });
});
