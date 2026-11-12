import { describe, expect, it } from 'vitest';
import { selectCanUndo, selectIsDirty } from '@/store';
import { CircuitBuilder } from '../helpers/circuitBuilder';
import { createTestApp, inp, out } from '../helpers/stores';

/*
 * Название документа и индикатор несохранённых изменений (`selectIsDirty`).
 * Сохранённое состояние — снимок схемы и название на момент сохранения или загрузки.
 */

function setup() {
  const t = createTestApp();
  const dirty = () => selectIsDirty(t.circuit());
  return { ...t, dirty };
}

describe('индикатор несохранённых изменений', () => {
  it('новый пустой документ не изменён', () => {
    const { dirty, circuit } = setup();
    expect(dirty()).toBe(false);
    expect(circuit().name).toBe('');
  });

  it('изменение схемы включает индикатор, сохранение выключает', () => {
    const { dirty, circuit } = setup();
    circuit().addComponent('AND', { x: 0, y: 0 });
    expect(dirty()).toBe(true);
    circuit().markSaved();
    expect(dirty()).toBe(false);
    expect(circuit().savedCircuit).toBe(circuit().circuit);
  });

  it('undo до сохранённого состояния выключает индикатор, redo снова включает', () => {
    const { dirty, circuit } = setup();
    circuit().addComponent('AND', { x: 0, y: 0 });
    circuit().markSaved();
    circuit().addComponent('OR', { x: 100, y: 0 });
    expect(dirty()).toBe(true);

    circuit().undo();
    expect(dirty()).toBe(false);
    // Undo возвращает тот же снимок: проверка по ссылке.
    expect(circuit().circuit).toBe(circuit().savedCircuit);

    circuit().redo();
    expect(dirty()).toBe(true);
    circuit().undo();
    expect(dirty()).toBe(false);
  });

  it('undo после новых изменений, но не до сохранённого, оставляет индикатор', () => {
    const { dirty, circuit } = setup();
    circuit().addComponent('AND', { x: 0, y: 0 });
    circuit().markSaved();
    circuit().addComponent('OR', { x: 100, y: 0 });
    circuit().addComponent('XOR', { x: 200, y: 0 });
    circuit().undo();
    expect(dirty()).toBe(true);
  });

  it('undo дальше сохранённого состояния включает индикатор', () => {
    const { dirty, circuit } = setup();
    circuit().addComponent('AND', { x: 0, y: 0 });
    circuit().addComponent('OR', { x: 100, y: 0 });
    circuit().markSaved();
    circuit().undo();
    expect(dirty()).toBe(true);
  });

  it('INPUT переключён туда и обратно, элемент возвращён на место — содержимое не изменилось', () => {
    const { dirty, circuit, app } = setup();
    const a = circuit().addComponent('INPUT', { x: 0, y: 0 });
    circuit().markSaved();

    app.commands.toggleInput(a);
    expect(dirty()).toBe(true);
    app.commands.toggleInput(a);
    expect(circuit().circuit).not.toBe(circuit().savedCircuit);
    expect(dirty()).toBe(false);

    circuit().moveComponents([{ id: a, position: { x: 50, y: 0 } }]);
    expect(dirty()).toBe(true);
    circuit().moveComponents([{ id: a, position: { x: 0, y: 0 } }]);
    expect(dirty()).toBe(false);
  });

  it('положение INPUT сохраняется в файл: undo правки не скрывает его изменение', () => {
    const { dirty, circuit, app } = setup();
    const a = circuit().addComponent('INPUT', { x: 0, y: 0 });
    circuit().markSaved();
    app.commands.toggleInput(a);
    circuit().addComponent('AND', { x: 100, y: 0 });
    circuit().undo();
    // Схема как при сохранении, но переключатель в другом положении (carryInteractiveProps).
    expect(circuit().circuit.components).toHaveLength(1);
    expect(dirty()).toBe(true);
  });

  it('загрузка задаёт новое сохранённое состояние', () => {
    const { dirty, circuit } = setup();
    circuit().addComponent('AND', { x: 0, y: 0 });
    const loaded = new CircuitBuilder().input('A').gate('N', 'NOT').wire('A', 'N').build();
    circuit().loadCircuit(loaded, { name: 'Инвертор' });
    expect(dirty()).toBe(false);
    expect(circuit().savedCircuit).toBe(loaded);
    expect(circuit().name).toBe('Инвертор');
    expect(circuit().savedName).toBe('Инвертор');
  });

  it('загрузка исправленной схемы (saved: false) оставляет индикатор включённым до сохранения', () => {
    const { dirty, circuit } = setup();
    circuit().loadCircuit(new CircuitBuilder().gate('G', 'AND').build(), { name: 'x', saved: false });
    expect(dirty()).toBe(true);
    circuit().markSaved();
    expect(dirty()).toBe(false);
  });

  it('clear — новый документ без названия и без изменений', () => {
    const { dirty, circuit } = setup();
    circuit().loadCircuit(new CircuitBuilder().gate('G', 'AND').build(), { name: 'x' });
    circuit().addComponent('OR', { x: 0, y: 0 });
    circuit().clear();
    expect(dirty()).toBe(false);
    expect(circuit().name).toBe('');
    expect(circuit().circuit.components).toEqual([]);
  });
});

describe('название документа', () => {
  it('переименование не добавляет запись в историю и не меняет версии', () => {
    const { circuit, simulation } = setup();
    circuit().addComponent('AND', { x: 0, y: 0 });
    const { history, documentVersion, structureVersion, propsVersion } = circuit();
    const compilations = simulation().compilations;

    circuit().renameDocument('Полусумматор');
    expect(circuit().name).toBe('Полусумматор');
    expect(circuit().history).toBe(history);
    expect([circuit().documentVersion, circuit().structureVersion, circuit().propsVersion]).toEqual([
      documentVersion,
      structureVersion,
      propsVersion,
    ]);
    expect(simulation().compilations).toBe(compilations);
  });

  it('undo и redo не откатывают название', () => {
    const { circuit } = setup();
    circuit().addComponent('AND', { x: 0, y: 0 });
    circuit().renameDocument('Имя');
    circuit().undo();
    expect(circuit().name).toBe('Имя');
    expect(selectCanUndo(circuit())).toBe(false);
    circuit().redo();
    expect(circuit().name).toBe('Имя');
  });

  it('переименование включает индикатор, возврат прежнего названия — выключает', () => {
    const { dirty, circuit } = setup();
    circuit().renameDocument('Новое');
    expect(dirty()).toBe(true);
    circuit().markSaved();
    expect(dirty()).toBe(false);
    circuit().renameDocument('Другое');
    expect(dirty()).toBe(true);
    circuit().renameDocument('Новое');
    expect(dirty()).toBe(false);
  });

  it('пробелы по краям обрезаются, длина ограничена', () => {
    const { circuit } = setup();
    circuit().renameDocument('   Схема  ');
    expect(circuit().name).toBe('Схема');
    circuit().renameDocument('я'.repeat(500));
    expect(circuit().name).toHaveLength(100);
  });

  it('переименование не вызывает перекомпиляцию и не меняет сигналы', () => {
    const { circuit, signal } = setup();
    const a = circuit().addComponent('INPUT', { x: 0, y: 0 }, { value: true });
    const n = circuit().addComponent('NOT', { x: 100, y: 0 });
    circuit().connect(out(a), inp(n));
    expect(signal(out(n))).toBe(0);
    circuit().renameDocument('x');
    expect(signal(out(n))).toBe(0);
  });
});
