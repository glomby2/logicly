import { describe, expect, it } from 'vitest';
import { buildTruthTable, type TruthTable, type TruthTableWarning } from '@/core/analysis';
import { createDefaultRegistry } from '@/core/elements';
import type { Circuit } from '@/core/types/circuit';
import {
  buildTruthTableView,
  cellView,
  currentRowIndex,
  rowCombination,
  warningText,
  type TruthTableView,
} from '@/features/truthTable/truthTableModel';
import { CircuitBuilder } from '../helpers/circuitBuilder';
import { halfAdder, norLatch } from '../helpers/circuits';

const registry = createDefaultRegistry();

const withLabels = (circuit: Circuit, labels: Record<string, string>): Circuit => ({
  ...circuit,
  components: circuit.components.map((c) => (labels[c.id] ? { ...c, label: labels[c.id] } : c)),
});

function tableOf(circuit: Circuit): { table: TruthTable; view: Extract<TruthTableView, { kind: 'table' }> } {
  const result = buildTruthTable(circuit, registry);
  if (!result.ok) throw new Error(result.reason);
  const view = buildTruthTableView(result, circuit, registry);
  if (view.kind !== 'table') throw new Error('ожидалась таблица');
  return { table: result.table, view };
}

const adder = () => withLabels(halfAdder().build(), { A: 'A', B: 'B', SUM: 'S', CARRY: 'C' });

describe('модель отображения таблицы истинности', () => {
  it('заголовки — подписи; сводка; строки', () => {
    const { view } = tableOf(adder());
    expect(view.inputs.map((c) => c.title)).toEqual(['A', 'B']);
    expect(view.outputs.map((c) => c.title)).toEqual(['C', 'S']);
    expect(view.summary).toBe('Входов: 2 · выходов: 2 · комбинаций: 4');
    expect(view.rows.map((r) => [...r.inputs, ...r.outputs].map((c) => c.text).join(''))).toEqual([
      '0000',
      '0101',
      '1001',
      '1110',
    ]);
    expect(view.notes).toEqual([]);
  });

  it('без подписи — имя как в инспекторе', () => {
    const { view } = tableOf(new CircuitBuilder().input('a').input('b').output('y').build());
    expect(view.inputs.map((c) => c.title)).toEqual(['INPUT #1', 'INPUT #2']);
    expect(view.outputs.map((c) => c.title)).toEqual(['OUTPUT']);
  });

  it('одинаковые подписи различаются номером в скобках, в том числе у входа и выхода', () => {
    const circuit = withLabels(new CircuitBuilder().input('a').input('b').output('y').wire('a', 'y').build(), {
      a: 'X1',
      b: 'X1',
      y: 'X1',
    });
    const { view } = tableOf(circuit);
    expect(view.inputs.map((c) => c.title)).toEqual(['X1 (1)', 'X1 (2)']);
    expect(view.outputs.map((c) => c.title)).toEqual(['X1 (3)']);
    expect(view.notes.some((n) => n.includes('Повторяющиеся подписи: X1'))).toBe(true);
  });

  it('несколько OUTPUT с одной подписью различимы; номер не совпадает с чужой подписью', () => {
    const circuit = withLabels(
      new CircuitBuilder()
        .input('a')
        .output('y1')
        .output('y2')
        .output('y3')
        .wire('a', 'y1')
        .wire('a', 'y2')
        .wire('a', 'y3')
        .build(),
      { a: 'A', y1: 'Y', y2: 'Y (1)', y3: 'Y' },
    );
    const { view } = tableOf(circuit);
    const titles = Object.fromEntries(view.outputs.map((c) => [c.componentId, c.title]));
    expect(titles.y2).toBe('Y (1)');
    expect([titles.y1, titles.y3].sort()).toEqual(['Y (2)', 'Y (3)']);
    expect(new Set(view.outputs.map((c) => c.title)).size).toBe(3);
  });

  it('неподключённый индикатор помечен подсказкой', () => {
    const { view } = tableOf(new CircuitBuilder().input('a').output('y').build());
    expect(view.outputs[0]!.hint).toContain('не подключён');
  });

  it('ячейки: 0, 1, X и ↺ с пояснением и значением после сброса', () => {
    expect(cellView({ kind: 'value', value: 0 })).toEqual({ text: '0', tone: 'zero' });
    expect(cellView({ kind: 'value', value: 1 })).toEqual({ text: '1', tone: 'one' });
    expect(cellView({ kind: 'unknown' })).toMatchObject({ text: 'X', tone: 'unknown' });
    const memory = cellView({ kind: 'memory', powerOn: 1 });
    expect(memory).toMatchObject({ text: '↺', tone: 'memory' });
    expect(memory.title).toContain('предыдущего состояния');
    expect(memory.title).toContain('После сброса: 1');
  });

  it('защёлка: ↺ в строке хранения и пояснение о памяти', () => {
    const { view } = tableOf(withLabels(norLatch().output('OQ').wire('Q', 'OQ').build(), { S: 'S', R: 'R', OQ: 'Q' }));
    expect(view.rows[0]!.outputs[0]!.text).toBe('↺');
    expect(view.notes[0]).toContain('элементы памяти');
  });

  it('сообщения вместо таблицы', () => {
    const view = (circuit: Circuit, maxInputs?: number) =>
      buildTruthTableView(buildTruthTable(circuit, registry, { maxInputs }), circuit, registry);
    expect(view({ components: [], wires: [] })).toEqual({ kind: 'message', text: expect.stringContaining('Схема пуста') });
    expect(view(new CircuitBuilder().input('a').build())).toMatchObject({ text: expect.stringContaining('нет выходов') });
    expect(view(new CircuitBuilder().input('a').input('b').output('y').build(), 1)).toMatchObject({
      text: expect.stringContaining('Слишком много входов: 2'),
    });
  });

  it('схема без входов — пояснение об одной строке', () => {
    const { view } = tableOf(new CircuitBuilder().gate('N', 'NOT').output('y').wire('N', 'y').build());
    expect(view.rows).toHaveLength(1);
    expect(view.notes[0]).toContain('одной строки');
  });

  it('у каждого предупреждения есть текст', () => {
    const warnings: TruthTableWarning[] = [
      { code: 'memory', count: 2 },
      { code: 'unknown', count: 3 },
      { code: 'stateful-elements', count: 1 },
      { code: 'time-elements', count: 1 },
      { code: 'floating-inputs', count: 4 },
      { code: 'duplicate-labels', labels: ['A', 'B'] },
      { code: 'diagnostics', count: 1 },
    ];
    for (const warning of warnings) expect(warningText(warning).length).toBeGreaterThan(10);
    expect(warningText({ code: 'duplicate-labels', labels: ['A', 'B'] })).toContain('A, B');
  });

  it('текущая строка — по положениям INPUT в схеме', () => {
    const circuit = adder();
    const { table } = tableOf(circuit);
    expect(currentRowIndex(table, circuit)).toBe(0);
    const set = (id: string) => ({
      ...circuit,
      components: circuit.components.map((c) => (c.id === id ? { ...c, props: { value: true } } : c)),
    });
    expect(currentRowIndex(table, set('A'))).toBe(2);
    expect(currentRowIndex(table, set('B'))).toBe(1);
    expect(currentRowIndex(table, { ...circuit, components: circuit.components.filter((c) => c.id !== 'A') })).toBe(-1);
  });

  it('комбинация строки для применения к входам', () => {
    const { table } = tableOf(adder());
    expect(rowCombination(table, 2)).toEqual([
      { componentId: 'A', prop: 'value', value: true },
      { componentId: 'B', prop: 'value', value: false },
    ]);
    expect(rowCombination(table, 99)).toEqual([]);
  });
});
