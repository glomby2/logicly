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

describe('DECODER, ENCODER, PRIORITY ENCODER: смена разрядности', () => {
  /** Элемент `type` с разрядностью 3; к каждому входу — INPUT, с каждого выхода — OUTPUT. */
  function wired(type: string) {
    const t = setup();
    const e = t.c().addComponent(type, { x: 100, y: 0 }, { codeBits: 3 });
    const pins = t.app.registry.require(type).pins({ codeBits: 3 });
    for (const p of pins.inputs) t.c().connect(out(t.c().addComponent('INPUT', { x: 0, y: 0 })), pin(e, p.id));
    for (const p of pins.outputs) t.c().connect(pin(e, p.id), pin(t.c().addComponent('OUTPUT', { x: 200, y: 0 }), 'in0'));
    /** Пины элемента, к которым подходят провода. */
    const wiredPins = () =>
      t.c().circuit.wires.flatMap((w) => (w.to.componentId === e ? [w.to.pinId] : w.from.componentId === e ? [w.from.pinId] : [])).sort();
    return { ...t, e, wiredPins };
  }

  it.each([
    ['DECODER', ['a0', 'a1', 'y0', 'y1', 'y2', 'y3']],
    ['ENCODER', ['a0', 'a1', 'd0', 'd1', 'd2', 'd3']],
    ['PRIORITY_ENCODER', ['a0', 'a1', 'd0', 'd1', 'd2', 'd3', 'v']],
  ])('%s 3 → 2: провода исчезнувших пинов удаляются, остальные сохраняются; один шаг истории; undo/redo', (type, kept) => {
    const t = wired(type);
    const all = t.wiredPins();
    const before = { structure: t.c().structureVersion, past: t.c().history.past.length, compilations: t.simulation().compilations };

    t.c().updateProps(t.e, { codeBits: 2 });
    expect(t.props(t.e)).toEqual({ codeBits: 2 });
    expect(t.wiredPins()).toEqual([...kept].sort());
    expect(t.c().structureVersion).toBe(before.structure + 1);
    expect(t.c().history.past).toHaveLength(before.past + 1);
    expect(t.simulation().compilations).toBe(before.compilations + 1);

    t.c().undo();
    expect(t.props(t.e)).toEqual({ codeBits: 3 });
    expect(t.wiredPins()).toEqual(all);
    t.c().redo();
    expect(t.wiredPins()).toEqual([...kept].sort());
  });

  it('DECODER 2 → 3: все провода сохраняются, адрес прежний', () => {
    const t = setup();
    const a1 = t.c().addComponent('INPUT', { x: 0, y: 0 }, { value: true });
    const d = t.c().addComponent('DECODER', { x: 100, y: 0 });
    const led = t.c().addComponent('OUTPUT', { x: 200, y: 0 });
    t.c().connect(out(a1), pin(d, 'a1'));
    t.c().connect(pin(d, 'y2'), pin(led, 'in0'));
    expect(t.signal(pin(d, 'y2'))).toBe(1);
    const wires = t.wireIds();

    t.c().updateProps(d, { codeBits: 3 });
    expect(t.wireIds()).toEqual(wires);
    // A2 не подключён (0): по-прежнему адрес 2.
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((k) => t.signal(pin(d, `y${k}`)))).toEqual([0, 0, 1, 0, 0, 0, 0, 0]);
  });

  it('смена разрядности DECODER не сбрасывает триггер соседней части схемы (exportState)', () => {
    const t = setup();
    const k = t.c().addComponent('CONSTANT', { x: 0, y: 0 });
    const c = t.c().addComponent('INPUT', { x: 0, y: 0 });
    const f = t.c().addComponent('D_FLIP_FLOP', { x: 100, y: 0 });
    const d = t.c().addComponent('DECODER', { x: 100, y: 200 });
    t.c().connect(out(k), pin(f, 'd'));
    t.c().connect(out(c), pin(f, 'clk'));
    t.c().connect(pin(f, 'q'), pin(d, 'a0'));
    t.app.commands.toggleInput(c); // фронт: Q = 1
    expect(t.signal(pin(f, 'q'))).toBe(1);
    expect(t.signal(pin(d, 'y1'))).toBe(1);
    const compilations = t.simulation().compilations;

    t.c().updateProps(d, { codeBits: 3 });
    expect(t.simulation().compilations).toBe(compilations + 1);
    expect(t.signal(pin(f, 'q'))).toBe(1);
    expect(t.signal(pin(d, 'y1'))).toBe(1);
  });
});

describe('CONSTANT в хранилищах', () => {
  it('смена уровня — свойство без смены пинов: propsVersion, без перекомпиляции, шаг истории; undo', () => {
    const t = setup();
    const k = t.c().addComponent('CONSTANT', { x: 0, y: 0 });
    const g = t.c().addComponent('NOT', { x: 100, y: 0 });
    t.c().connect(out(k), pin(g, 'in0'));
    expect(t.props(k)).toEqual({ level: true });
    expect([t.signal(out(k)), t.signal(out(g))]).toEqual([1, 0]);
    const before = {
      structure: t.c().structureVersion,
      props: t.c().propsVersion,
      past: t.c().history.past.length,
      compilations: t.simulation().compilations,
    };

    t.c().updateProps(k, { level: false });
    expect([t.signal(out(k)), t.signal(out(g))]).toEqual([0, 1]);
    expect(t.c().structureVersion).toBe(before.structure);
    expect(t.c().propsVersion).toBe(before.props + 1);
    expect(t.c().history.past).toHaveLength(before.past + 1);
    expect(t.simulation().compilations).toBe(before.compilations);

    t.c().undo();
    expect(t.props(k)).toEqual({ level: true });
    expect(t.signal(out(k))).toBe(1);
  });

  it('команда переключения INPUT не меняет CONSTANT', () => {
    const t = setup();
    const k = t.c().addComponent('CONSTANT', { x: 0, y: 0 });
    const before = t.c().circuit;
    t.app.commands.toggleInput(k);
    expect(t.c().circuit).toBe(before);
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
