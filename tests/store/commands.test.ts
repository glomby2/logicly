import { describe, expect, it } from 'vitest';
import { createTestApp, inp, out } from '../helpers/stores';

describe('команды приложения', () => {
  it('placeElement добавляет и выделяет элемент, завершая режим размещения', () => {
    const { app, circuit } = createTestApp();
    app.ui.getState().startPlacement('AND');
    const id = app.commands.placeElement('AND', { x: 40, y: 80 });
    expect(circuit().circuit.components).toEqual([
      { id, type: 'AND', position: { x: 40, y: 80 }, props: { inputCount: 2 } },
    ]);
    expect(app.ui.getState().selection.components).toEqual([id]);
    expect(app.ui.getState().placement).toBeNull();
  });

  it('deleteSelection удаляет выделенные элементы и провода и очищает выделение', () => {
    const { app, circuit } = createTestApp();
    const a = app.commands.placeElement('INPUT', { x: 0, y: 0 });
    const g = app.commands.placeElement('AND', { x: 0, y: 0 });
    const l = app.commands.placeElement('OUTPUT', { x: 0, y: 0 });
    circuit().connect(out(a), inp(g));
    circuit().connect(out(g), inp(l));
    const wireToOutput = circuit().circuit.wires[1]!.id;

    app.ui.getState().select({ components: [a], wires: [wireToOutput] });
    app.commands.deleteSelection();
    expect(circuit().circuit.components.map((c) => c.id)).toEqual([g, l]);
    expect(circuit().circuit.wires).toEqual([]);
    expect(app.ui.getState().selection).toEqual({ components: [], wires: [] });
  });

  it('deleteSelection без выделения ничего не делает', () => {
    const { app, circuit } = createTestApp();
    app.commands.placeElement('INPUT', { x: 0, y: 0 });
    app.ui.getState().clearSelection();
    const state = circuit().circuit;
    app.commands.deleteSelection();
    expect(circuit().circuit).toBe(state);
  });

  it('toggleInput переключает только INPUT', () => {
    const { app, circuit, signal } = createTestApp();
    const a = app.commands.placeElement('INPUT', { x: 0, y: 0 });
    const g = app.commands.placeElement('AND', { x: 0, y: 0 });
    app.commands.toggleInput(a);
    expect(signal(out(a))).toBe(1);
    app.commands.toggleInput(a);
    expect(signal(out(a))).toBe(0);

    const before = circuit().circuit;
    app.commands.toggleInput(g);
    app.commands.toggleInput('missing');
    expect(circuit().circuit).toBe(before);
  });

  it('выделение очищается от элементов, исчезнувших после undo', () => {
    const { app, circuit } = createTestApp();
    const id = app.commands.placeElement('AND', { x: 0, y: 0 });
    expect(app.ui.getState().selection.components).toEqual([id]);
    circuit().undo();
    expect(app.ui.getState().selection.components).toEqual([]);
  });
});
