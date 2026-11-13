import type { TruthCell, TruthTable, TruthTableResult, TruthTableWarning } from '@/core/analysis';
import { findComponent } from '@/core/circuit';
import type { ElementRegistry } from '@/core/elements';
import type { Circuit, ComponentId } from '@/core/types/circuit';
import { componentName } from '@/features/inspector/inspectorModel';
import { ru } from '@/i18n/ru';
import type { InputValue } from '@/store';

/*
 * Модель отображения таблицы истинности: результат анализа + схема → то, что показывает
 * диалог. Чистые функции без React — проверяются unit-тестами.
 */

export interface TruthColumnView {
  readonly componentId: ComponentId;
  readonly title: string;
  /** Подсказка к заголовку (например, неподключённый индикатор). */
  readonly hint?: string;
}

export type CellTone = 'zero' | 'one' | 'unknown' | 'memory';

export interface TruthCellView {
  readonly text: string;
  readonly tone: CellTone;
  readonly title?: string;
}

export interface TruthRowView {
  readonly inputs: readonly TruthCellView[];
  readonly outputs: readonly TruthCellView[];
  readonly unstable: boolean;
}

export type TruthTableView =
  | { readonly kind: 'message'; readonly text: string }
  | {
      readonly kind: 'table';
      readonly summary: string;
      readonly inputs: readonly TruthColumnView[];
      readonly outputs: readonly TruthColumnView[];
      readonly rows: readonly TruthRowView[];
      /** Пояснения и предупреждения в порядке показа. */
      readonly notes: readonly string[];
    };

const ZERO: TruthCellView = { text: '0', tone: 'zero' };
const ONE: TruthCellView = { text: '1', tone: 'one' };

export function cellView(cell: TruthCell): TruthCellView {
  switch (cell.kind) {
    case 'value':
      return cell.value === 1 ? ONE : ZERO;
    case 'unknown':
      return { text: 'X', tone: 'unknown', title: ru.truthTable.unknownTitle };
    case 'memory':
      return { text: '↺', tone: 'memory', title: ru.truthTable.memoryTitle(String(cell.powerOn)) };
  }
}

export function warningText(warning: TruthTableWarning): string {
  const texts = ru.truthTable.warnings;
  return warning.code === 'duplicate-labels' ? texts['duplicate-labels'](warning.labels) : texts[warning.code](warning.count);
}

/**
 * Заголовки столбцов: подпись элемента, без подписи — имя как в инспекторе.
 * Одинаковые заголовки получают номер в скобках по порядку столбцов: «X1 (1)», «X1 (2)».
 * Номер, совпадающий с чужой подписью (у элемента подпись «X1 (1)»), пропускается.
 */
function columnTitles(table: TruthTable, circuit: Circuit, registry: ElementRegistry): string[] {
  const titles = [...table.inputs, ...table.outputs].map((port) => {
    const component = findComponent(circuit, port.componentId);
    return port.label ?? (component ? componentName(circuit, registry, component) : port.componentId);
  });
  const total = new Map<string, number>();
  for (const title of titles) total.set(title, (total.get(title) ?? 0) + 1);
  const taken = new Set(titles.filter((title) => total.get(title)! < 2));
  const seen = new Map<string, number>();
  return titles.map((title) => {
    if (total.get(title)! < 2) return title;
    let n = seen.get(title) ?? 0;
    let numbered: string;
    do numbered = `${title} (${++n})`;
    while (taken.has(numbered));
    seen.set(title, n);
    taken.add(numbered);
    return numbered;
  });
}

export function buildTruthTableView(result: TruthTableResult, circuit: Circuit, registry: ElementRegistry): TruthTableView {
  if (!result.ok) {
    const { messages } = ru.truthTable;
    const text =
      result.reason === 'too-many-inputs' ? messages['too-many-inputs'](result.inputCount, result.limit) : messages[result.reason];
    return { kind: 'message', text };
  }

  const { table } = result;
  const titles = columnTitles(table, circuit, registry);
  const inputs = table.inputs.map((port, i) => ({ componentId: port.componentId, title: titles[i]! }));
  const outputs = table.outputs.map((port, i) => ({
    componentId: port.componentId,
    title: titles[table.inputs.length + i]!,
    ...(port.floating ? { hint: ru.truthTable.floatingOutput } : {}),
  }));

  return {
    kind: 'table',
    summary: ru.truthTable.summary(table.inputs.length, table.outputs.length, table.rows.length),
    inputs,
    outputs,
    rows: table.rows.map((row) => ({
      inputs: row.inputs.map((bit) => (bit === 1 ? ONE : ZERO)),
      outputs: row.outputs.map(cellView),
      unstable: row.unstable,
    })),
    notes: [...(table.inputs.length === 0 ? [ru.truthTable.messages.noInputs] : []), ...table.warnings.map(warningText)],
  };
}

/** Номер строки, совпадающей с текущими положениями входов схемы; `-1`, если вход не найден. */
export function currentRowIndex(table: TruthTable, circuit: Circuit): number {
  let index = 0;
  for (const port of table.inputs) {
    const component = findComponent(circuit, port.componentId);
    if (!component) return -1;
    index = index * 2 + (component.props[port.prop] === true ? 1 : 0);
  }
  return index;
}

/** Значения входов для строки таблицы — аргумент команды `applyInputCombination`. */
export function rowCombination(table: TruthTable, rowIndex: number): InputValue[] {
  const row = table.rows[rowIndex];
  if (!row) return [];
  return table.inputs.map((port, i) => ({ componentId: port.componentId, prop: port.prop, value: row.inputs[i] === 1 }));
}
