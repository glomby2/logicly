import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { CircuitBuilder } from '../helpers/circuitBuilder';
import { norLatch } from '../helpers/circuits';
import { TEST_CLOCK } from '../helpers/fixtureElements';
import { createTestApp, inp, out } from '../helpers/stores';

/** INPUT a, INPUT b → AND g → OUTPUT l. */
function andCircuit() {
  const t = createTestApp();
  const c = t.circuit();
  const a = c.addComponent('INPUT', { x: 0, y: 0 });
  const b = c.addComponent('INPUT', { x: 0, y: 0 });
  const g = c.addComponent('AND', { x: 0, y: 0 });
  const l = c.addComponent('OUTPUT', { x: 0, y: 0 });
  t.circuit().connect(out(a), inp(g, 0));
  t.circuit().connect(out(b), inp(g, 1));
  t.circuit().connect(out(g), inp(l));
  return { ...t, a, b, g, l };
}

/** Защёлка, загруженная как документ и установленная в Q = 1. */
function setLatch() {
  const t = createTestApp();
  t.circuit().loadCircuit(norLatch().build());
  t.app.commands.toggleInput('S');
  t.app.commands.toggleInput('S');
  return t;
}

describe('мост схема → движок', () => {
  it('публикует результаты при создании', () => {
    const { simulation } = createTestApp();
    expect(simulation()).toMatchObject({ signals: {}, status: 'stable', compilations: 1 });
  });

  it('добавление проводов перекомпилирует схему и обновляет сигналы', () => {
    const { simulation, signal, g, l } = andCircuit();
    expect(signal(out(g))).toBe(0);
    expect(signal(inp(l))).toBe(0);
    expect(simulation().floatingInputs.size).toBe(0);
  });

  it('переключение INPUT пересчитывает зависимую часть без перекомпиляции', () => {
    const { app, simulation, signal, a, b, g, l } = andCircuit();
    const compilations = simulation().compilations;
    const engine = app.simulationBridge.getEngine();

    app.commands.toggleInput(a);
    expect(signal(out(g))).toBe(0);
    app.commands.toggleInput(b);
    expect([signal(out(g)), signal(inp(l))]).toEqual([1, 1]);
    // Пересчитаны только INPUT, AND и OUTPUT.
    expect(simulation().evaluations).toBe(3);
    expect(simulation().compilations).toBe(compilations);
    expect(app.simulationBridge.getEngine()).toBe(engine);
  });

  it('перемещение и переименование не затрагивают симуляцию', () => {
    const { app, simulation, circuit, g } = andCircuit();
    const state = simulation();
    const engine = app.simulationBridge.getEngine();

    circuit().beginBatch();
    for (let x = 1; x <= 10; x++) circuit().moveComponents([{ id: g, position: { x, y: x } }]);
    circuit().endBatch();
    circuit().renameComponent(g, 'Gate');
    circuit().undo();
    circuit().undo();

    expect(simulation()).toBe(state);
    expect(app.simulationBridge.getEngine()).toBe(engine);
  });

  it('удаление провода делает вход неподключённым (0) и обновляет выход', () => {
    const { app, simulation, signal, circuit, a, b, g } = andCircuit();
    app.commands.toggleInput(a);
    app.commands.toggleInput(b);
    expect(signal(out(g))).toBe(1);

    const wire = circuit().circuit.wires.find((w) => w.to.componentId === g && w.to.pinId === 'in1')!;
    circuit().remove({ wires: [wire.id] });
    expect(signal(inp(g, 1))).toBe(0);
    expect(signal(out(g))).toBe(0);
    expect([...simulation().floatingInputs]).toEqual([`${g}:in1`]);
  });

  it('удаление элемента убирает его сигналы и обновляет зависимые', () => {
    const { app, simulation, signal, circuit, a, b, g, l } = andCircuit();
    app.commands.toggleInput(a);
    app.commands.toggleInput(b);
    circuit().remove({ components: [g] });

    expect(signal(out(g))).toBeUndefined();
    expect(signal(inp(l))).toBe(0);
    expect(simulation().floatingInputs.has(`${l}:in0`)).toBe(true);
  });

  it('изменение числа входов перекомпилирует схему и создаёт сигналы новых пинов', () => {
    const { simulation, signal, circuit, g } = andCircuit();
    const compilations = simulation().compilations;
    circuit().updateProps(g, { inputCount: 3 });
    expect(simulation().compilations).toBe(compilations + 1);
    expect(signal(inp(g, 2))).toBe(0);
    expect(simulation().floatingInputs.has(`${g}:in2`)).toBe(true);
  });

  it('undo удаления восстанавливает схему и симуляцию', () => {
    const { app, signal, circuit, a, b, g } = andCircuit();
    app.commands.toggleInput(a);
    app.commands.toggleInput(b);
    circuit().remove({ components: [g] });
    circuit().undo();
    expect(signal(out(g))).toBe(1);
  });

  it('публикует статус и неопределённые сети нестабильной схемы', () => {
    const { simulation, circuit } = createTestApp();
    circuit().loadCircuit(new CircuitBuilder().gate('N', 'NOT').wire('N', 'N').build());
    expect(simulation().status).toBe('oscillation');
    expect(simulation().unknownNets).toEqual(['N:out0']);
    expect(simulation().feedbackComponents).toEqual(new Set(['N']));
  });

  it('dispose отключает мост', () => {
    const { app, simulation, a } = andCircuit();
    const state = simulation();
    app.dispose();
    app.commands.toggleInput(a);
    expect(simulation()).toBe(state);
  });
});

describe('сохранение состояния симуляции при изменении схемы', () => {
  it('защёлка сохраняет Q при добавлении элемента', () => {
    const { signal, circuit } = setLatch();
    expect([signal(out('Q')), signal(out('QN'))]).toEqual([1, 0]);
    circuit().addComponent('AND', { x: 0, y: 0 });
    expect([signal(out('Q')), signal(out('QN'))]).toEqual([1, 0]);
  });

  it('защёлка сохраняет Q при удалении несвязанного провода и при undo', () => {
    const { signal, circuit } = setLatch();
    const extra = circuit().addComponent('INPUT', { x: 0, y: 0 });
    const gate = circuit().addComponent('NOT', { x: 0, y: 0 });
    circuit().connect(out(extra), inp(gate));
    circuit().remove({ wires: [circuit().circuit.wires.at(-1)!.id] });
    expect(signal(out('Q'))).toBe(1);
    circuit().undo();
    circuit().undo();
    expect(signal(out('Q'))).toBe(1);
  });

  it('загрузка документа начинает симуляцию с состояния включения', () => {
    const { simulation, signal, circuit } = setLatch();
    const compilations = simulation().compilations;
    circuit().loadCircuit(norLatch().build());
    expect(simulation().compilations).toBe(compilations + 1);
    expect([signal(out('Q')), signal(out('QN'))]).toEqual([0, 1]);
  });
});

describe('управление временем: Step и Reset', () => {
  it('step продвигает время, reset возвращает состояние включения', () => {
    const registry = createDefaultRegistry();
    registry.register(TEST_CLOCK);
    const { app, simulation, signal, circuit } = createTestApp({ registry });
    const clock = circuit().addComponent('TEST_CLOCK', { x: 0, y: 0 });

    app.simulationBridge.step();
    expect(simulation().time).toBe(1);
    expect(signal(out(clock))).toBe(1);
    app.simulationBridge.step();
    expect(signal(out(clock))).toBe(0);

    app.simulationBridge.step();
    app.simulationBridge.reset();
    expect(simulation().time).toBe(0);
    expect(signal(out(clock))).toBe(0);
  });

  it('время сохраняется при перекомпиляции', () => {
    const registry = createDefaultRegistry();
    registry.register(TEST_CLOCK);
    const { app, simulation, circuit } = createTestApp({ registry });
    circuit().addComponent('TEST_CLOCK', { x: 0, y: 0 });
    app.simulationBridge.step();
    app.simulationBridge.step();
    circuit().addComponent('NOT', { x: 0, y: 0 });
    expect(simulation().time).toBe(2);
  });
});
