import { describe, expect, it } from 'vitest';
import { PASTE_OFFSET } from '@/store';
import { createTestApp, inp, out } from '../helpers/stores';

/** INPUT → NOT, оба выделены. */
function selectedPair() {
  const t = createTestApp();
  const a = t.app.commands.placeElement('INPUT', { x: 0, y: 0 });
  const n = t.app.commands.placeElement('NOT', { x: 100, y: 0 });
  t.circuit().connect(out(a), inp(n));
  t.app.ui.getState().select({ components: [a, n] });
  return { ...t, a, n };
}

describe('автоматические подписи', () => {
  it('INPUT и OUTPUT получают подписи X1, X2, Y1; вентили — нет', () => {
    const { app, circuit } = createTestApp();
    app.commands.placeElement('INPUT', { x: 0, y: 0 });
    app.commands.placeElement('INPUT', { x: 0, y: 0 });
    app.commands.placeElement('OUTPUT', { x: 0, y: 0 });
    app.commands.placeElement('AND', { x: 0, y: 0 });
    expect(circuit().circuit.components.map((c) => c.label)).toEqual(['X1', 'X2', 'Y1', undefined]);
  });
});

describe('копирование и вставка', () => {
  it('копирует элементы с проводами между ними и вставляет со смещением', () => {
    const { app, circuit } = selectedPair();
    expect(app.commands.copySelection()).toBe(true);
    app.commands.paste();

    const { components, wires } = circuit().circuit;
    expect(components).toHaveLength(4);
    expect(wires).toHaveLength(2);
    const pasted = components.slice(2);
    expect(pasted.map((c) => c.position)).toEqual([
      { x: PASTE_OFFSET, y: PASTE_OFFSET },
      { x: 100 + PASTE_OFFSET, y: PASTE_OFFSET },
    ]);
    // Вставленное выделено, провод копии соединяет копии.
    expect(app.ui.getState().selection.components).toEqual(pasted.map((c) => c.id));
    expect(wires[1]).toMatchObject({ from: { componentId: pasted[0]!.id }, to: { componentId: pasted[1]!.id } });
  });

  it('каждая следующая вставка смещается дальше; вставка — один шаг истории', () => {
    const { app, circuit } = selectedPair();
    app.commands.copySelection();
    app.commands.paste();
    app.commands.paste();
    expect(circuit().circuit.components.slice(4).map((c) => c.position.x)).toEqual([2 * PASTE_OFFSET, 100 + 2 * PASTE_OFFSET]);
    circuit().undo();
    expect(circuit().circuit.components).toHaveLength(4);
  });

  it('вставка в указанную точку', () => {
    const { app, circuit } = selectedPair();
    app.commands.copySelection();
    app.commands.paste({ x: 500, y: 300 });
    expect(circuit().circuit.components.slice(2).map((c) => c.position)).toEqual([
      { x: 500, y: 300 },
      { x: 600, y: 300 },
    ]);
  });

  it('копии сохраняют подписи и состояние переключателя, симуляция пересчитывается', () => {
    const { app, circuit, signal, a } = selectedPair();
    app.commands.toggleInput(a);
    app.commands.copySelection();
    app.commands.paste();
    const [copyInput, copyNot] = circuit().circuit.components.slice(2);
    expect(copyInput).toMatchObject({ label: 'X1', props: { value: true } });
    expect(signal(out(copyNot!.id))).toBe(0);
  });

  it('без выделения копировать и вставлять нечего', () => {
    const { app, circuit } = createTestApp();
    app.commands.placeElement('AND', { x: 0, y: 0 });
    app.ui.getState().clearSelection();
    expect(app.commands.copySelection()).toBe(false);
    app.commands.paste();
    expect(circuit().circuit.components).toHaveLength(1);
  });

  it('вырезать = копировать + удалить', () => {
    const { app, circuit } = selectedPair();
    app.commands.cutSelection();
    expect(circuit().circuit.components).toEqual([]);
    app.commands.paste();
    expect(circuit().circuit.components).toHaveLength(2);
    expect(circuit().circuit.wires).toHaveLength(1);
  });

  it('дублирование не меняет буфер обмена', () => {
    const { app, circuit } = selectedPair();
    app.commands.duplicateSelection();
    expect(circuit().circuit.components).toHaveLength(4);
    expect(app.ui.getState().clipboard).toBeNull();
  });
});

describe('выделить всё и очистка', () => {
  it('selectAll выделяет все элементы и провода', () => {
    const { app, circuit } = selectedPair();
    app.ui.getState().clearSelection();
    app.commands.selectAll();
    expect(app.ui.getState().selection).toEqual({
      components: circuit().circuit.components.map((c) => c.id),
      wires: circuit().circuit.wires.map((w) => w.id),
    });
  });

  it('clearAll удаляет всё одним шагом, который можно отменить', () => {
    const { app, circuit } = selectedPair();
    app.commands.clearAll();
    expect(circuit().circuit).toEqual({ components: [], wires: [] });
    circuit().undo();
    expect(circuit().circuit.components).toHaveLength(2);
    expect(circuit().circuit.wires).toHaveLength(1);
  });
});

describe('переподключение провода через хранилище', () => {
  it('reconnect — один шаг истории и пересчёт симуляции', () => {
    const { app, circuit, signal } = createTestApp();
    const a = app.commands.placeElement('INPUT', { x: 0, y: 0 });
    const b = app.commands.placeElement('INPUT', { x: 0, y: 0 });
    const l = app.commands.placeElement('OUTPUT', { x: 0, y: 0 });
    circuit().connect(out(a), inp(l));
    app.commands.toggleInput(b);
    const wire = circuit().circuit.wires[0]!.id;
    const past = circuit().history.past.length;

    expect(circuit().reconnect(wire, out(b), inp(l)).ok).toBe(true);
    expect(signal(inp(l))).toBe(1);
    expect(circuit().history.past).toHaveLength(past + 1);
    circuit().undo();
    expect(signal(inp(l))).toBe(0);
  });
});
