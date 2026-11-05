import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { createCircuitStore, selectCanRedo, selectCanUndo } from '@/store';
import { CircuitBuilder } from '../helpers/circuitBuilder';
import { inp, out, sequentialIds } from '../helpers/stores';

function setup() {
  const store = createCircuitStore({ registry: createDefaultRegistry(), createId: sequentialIds() });
  const state = () => store.getState();
  const versions = () => ({
    document: state().documentVersion,
    structure: state().structureVersion,
    props: state().propsVersion,
  });
  return { store, state, versions };
}

describe('circuitStore: добавление и перемещение', () => {
  it('addComponent создаёт элемент с уникальным id и приведёнными свойствами', () => {
    const { state, versions } = setup();
    const id = state().addComponent('AND', { x: 10, y: 20 }, { inputCount: 50 });
    expect(id).toBe('and-1');
    expect(state().circuit.components).toEqual([
      { id: 'and-1', type: 'AND', position: { x: 10, y: 20 }, props: { inputCount: 8 } },
    ]);
    expect(versions()).toEqual({ document: 0, structure: 1, props: 0 });
    expect(selectCanUndo(state())).toBe(true);
  });

  it('не создаёт повторяющиеся id', () => {
    const store = createCircuitStore({ registry: createDefaultRegistry(), createId: () => 'fixed' });
    let calls = 0;
    const flaky = createCircuitStore({
      registry: createDefaultRegistry(),
      createId: (prefix) => `${prefix}-${calls++ < 2 ? 'same' : calls}`,
    });
    expect(store.getState().addComponent('AND', { x: 0, y: 0 })).toBe('fixed');
    const a = flaky.getState().addComponent('AND', { x: 0, y: 0 });
    const b = flaky.getState().addComponent('AND', { x: 0, y: 0 });
    expect(a).not.toBe(b);
  });

  it('перемещение не меняет версий структуры и свойств', () => {
    const { state, versions } = setup();
    const id = state().addComponent('AND', { x: 0, y: 0 });
    const before = versions();
    state().moveComponents([{ id, position: { x: 100, y: 50 } }]);
    expect(state().circuit.components[0]!.position).toEqual({ x: 100, y: 50 });
    expect(versions()).toEqual(before);
  });

  it('перемещение в ту же точку ничего не меняет', () => {
    const { state } = setup();
    const id = state().addComponent('AND', { x: 0, y: 0 });
    const circuit = state().circuit;
    state().moveComponents([{ id, position: { x: 0, y: 0 } }]);
    expect(state().circuit).toBe(circuit);
  });

  it('renameComponent задаёт и удаляет подпись без изменения версий', () => {
    const { state, versions } = setup();
    const id = state().addComponent('INPUT', { x: 0, y: 0 });
    const before = versions();
    state().renameComponent(id, '  A  ');
    expect(state().circuit.components[0]!.label).toBe('A');
    state().renameComponent(id, '');
    expect(state().circuit.components[0]!.label).toBeUndefined();
    expect(versions()).toEqual(before);
  });
});

describe('circuitStore: свойства', () => {
  it('изменение значения INPUT — версия свойств, без записи в историю', () => {
    const { state, versions } = setup();
    const id = state().addComponent('INPUT', { x: 0, y: 0 });
    const pastLength = state().history.past.length;
    state().updateProps(id, { value: true });
    expect(state().circuit.components[0]!.props).toEqual({ value: true });
    expect(versions()).toEqual({ document: 0, structure: 1, props: 1 });
    expect(state().history.past).toHaveLength(pastLength);
  });

  it('изменение числа входов — версия структуры, запись в историю, удаление проводов', () => {
    const { state, versions } = setup();
    const a = state().addComponent('INPUT', { x: 0, y: 0 });
    const g = state().addComponent('AND', { x: 0, y: 0 }, { inputCount: 4 });
    state().connect(out(a), inp(g, 3));
    const before = versions();
    const pastLength = state().history.past.length;

    state().updateProps(g, { inputCount: 2 });
    expect(versions().structure).toBe(before.structure + 1);
    expect(state().circuit.wires).toEqual([]);
    expect(state().history.past).toHaveLength(pastLength + 1);
  });

  it('то же значение свойства ничего не меняет', () => {
    const { state } = setup();
    const g = state().addComponent('AND', { x: 0, y: 0 });
    const circuit = state().circuit;
    state().updateProps(g, { inputCount: 2 });
    state().updateProps('missing', { inputCount: 3 });
    expect(state().circuit).toBe(circuit);
  });
});

describe('circuitStore: соединения и удаление', () => {
  it('connect нормализует направление и заменяет провод на занятом входе', () => {
    const { state } = setup();
    const a = state().addComponent('INPUT', { x: 0, y: 0 });
    const b = state().addComponent('INPUT', { x: 0, y: 0 });
    const g = state().addComponent('AND', { x: 0, y: 0 });

    expect(state().connect(inp(g, 0), out(a))).toMatchObject({ ok: true });
    expect(state().connect(out(b), inp(g, 0))).toMatchObject({ ok: true, replaces: 'w-4' });
    expect(state().circuit.wires).toEqual([{ id: 'w-5', from: out(b), to: inp(g, 0) }]);
  });

  it('недопустимое соединение не меняет схему', () => {
    const { state, versions } = setup();
    const a = state().addComponent('INPUT', { x: 0, y: 0 });
    const b = state().addComponent('INPUT', { x: 0, y: 0 });
    const before = versions();
    const circuit = state().circuit;
    expect(state().connect(out(a), out(b))).toEqual({ ok: false, reason: 'same-direction' });
    expect(state().circuit).toBe(circuit);
    expect(versions()).toEqual(before);
  });

  it('remove удаляет элементы вместе с проводами и отдельные провода', () => {
    const { state } = setup();
    const a = state().addComponent('INPUT', { x: 0, y: 0 });
    const g = state().addComponent('AND', { x: 0, y: 0 });
    const l = state().addComponent('OUTPUT', { x: 0, y: 0 });
    state().connect(out(a), inp(g, 0));
    state().connect(out(g), inp(l));

    state().remove({ wires: ['w-5'] });
    expect(state().circuit.wires.map((w) => w.id)).toEqual(['w-4']);
    state().remove({ components: [a] });
    expect(state().circuit.components.map((c) => c.id)).toEqual([g, l]);
    expect(state().circuit.wires).toEqual([]);
  });

  it('удаление несуществующего ничего не меняет', () => {
    const { state } = setup();
    state().addComponent('INPUT', { x: 0, y: 0 });
    const circuit = state().circuit;
    state().remove({ components: ['nope'], wires: ['nope'] });
    expect(state().circuit).toBe(circuit);
  });
});

describe('circuitStore: undo / redo', () => {
  it('отменяет и повторяет изменения', () => {
    const { state } = setup();
    const a = state().addComponent('INPUT', { x: 0, y: 0 });
    const g = state().addComponent('NOT', { x: 0, y: 0 });
    state().connect(out(a), inp(g));
    const connected = state().circuit;

    state().undo();
    expect(state().circuit.wires).toEqual([]);
    state().undo();
    expect(state().circuit.components.map((c) => c.id)).toEqual([a]);
    expect(selectCanRedo(state())).toBe(true);

    state().redo();
    state().redo();
    expect(state().circuit).toEqual(connected);
    expect(selectCanRedo(state())).toBe(false);
  });

  it('undo перемещения не требует перекомпиляции', () => {
    const { state, versions } = setup();
    const id = state().addComponent('AND', { x: 0, y: 0 });
    state().moveComponents([{ id, position: { x: 30, y: 0 } }]);
    const before = versions();
    state().undo();
    expect(state().circuit.components[0]!.position).toEqual({ x: 0, y: 0 });
    expect(versions()).toEqual(before);
  });

  it('undo структурного изменения увеличивает версию структуры', () => {
    const { state, versions } = setup();
    state().addComponent('AND', { x: 0, y: 0 });
    const before = versions();
    state().undo();
    expect(versions().structure).toBe(before.structure + 1);
  });

  it('undo сохраняет текущее положение переключателей', () => {
    const { state } = setup();
    const a = state().addComponent('INPUT', { x: 0, y: 0 });
    state().addComponent('AND', { x: 0, y: 0 });
    state().updateProps(a, { value: true });
    state().undo();
    expect(state().circuit.components).toEqual([
      { id: a, type: 'INPUT', position: { x: 0, y: 0 }, props: { value: true } },
    ]);
  });

  it('новое изменение после undo сбрасывает redo', () => {
    const { state } = setup();
    state().addComponent('AND', { x: 0, y: 0 });
    state().undo();
    state().addComponent('OR', { x: 0, y: 0 });
    expect(selectCanRedo(state())).toBe(false);
  });
});

describe('circuitStore: группировка изменений', () => {
  it('перетаскивание из многих шагов — один шаг истории', () => {
    const { state } = setup();
    const id = state().addComponent('AND', { x: 0, y: 0 });
    const pastLength = state().history.past.length;

    state().beginBatch();
    for (let x = 1; x <= 20; x++) state().moveComponents([{ id, position: { x, y: 0 } }]);
    expect(selectCanUndo(state())).toBe(false);
    state().endBatch();

    expect(state().history.past).toHaveLength(pastLength + 1);
    state().undo();
    expect(state().circuit.components[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it('пустая группа не пишет историю; undo внутри группы игнорируется', () => {
    const { state } = setup();
    state().addComponent('AND', { x: 0, y: 0 });
    const pastLength = state().history.past.length;
    state().beginBatch();
    state().undo();
    expect(state().circuit.components).toHaveLength(1);
    state().endBatch();
    expect(state().history.past).toHaveLength(pastLength);
  });
});

describe('circuitStore: загрузка документа', () => {
  it('loadCircuit заменяет схему, увеличивает версию документа и очищает историю', () => {
    const { state, versions } = setup();
    state().addComponent('AND', { x: 0, y: 0 });
    const loaded = new CircuitBuilder().input('A').gate('N', 'NOT').wire('A', 'N').build();
    const before = versions();

    state().loadCircuit(loaded);
    expect(state().circuit).toBe(loaded);
    expect(versions().document).toBe(before.document + 1);
    expect(versions().structure).toBe(before.structure + 1);
    expect(selectCanUndo(state())).toBe(false);

    state().clear();
    expect(state().circuit.components).toEqual([]);
    expect(versions().document).toBe(before.document + 2);
  });
});
