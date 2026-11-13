import type { ElementRegistry } from '../elements/registry';
import { UNKNOWN, type Signal } from '../logic/signal';
import { compileCircuit } from '../simulation/compile';
import { SimulationEngine, type EngineState, type SettleStatus } from '../simulation/engine';
import { findFloatingInputs, netIdOf, type Netlist } from '../simulation/netlist';
import type { Circuit } from '../types/circuit';
import { findPorts, type InputPort, type OutputPort } from './ports';

/** Больше входов таблица не строит: 2¹⁰ = 1024 строки. */
export const MAX_TRUTH_TABLE_INPUTS = 10;

/**
 * Значение выхода в строке таблицы:
 * - `value` — определено входами;
 * - `memory` — зависит от предыдущего состояния схемы (защёлка хранит значение);
 *   `powerOn` — значение сразу после сброса, для справки;
 * - `unknown` — X: неопределённость или колебание даже после сброса.
 */
export type TruthCell =
  | { readonly kind: 'value'; readonly value: 0 | 1 }
  | { readonly kind: 'memory'; readonly powerOn: Signal }
  | { readonly kind: 'unknown' };

export interface TruthRow {
  /** Значения входов в порядке `table.inputs`. */
  readonly inputs: readonly (0 | 1)[];
  readonly outputs: readonly TruthCell[];
  /** В строке обнаружено колебание. */
  readonly unstable: boolean;
}

export interface TruthOutput extends OutputPort {
  /** Вход индикатора не подключён: значение всегда 0. */
  readonly floating: boolean;
}

export type TruthTableWarning =
  /** Есть ячейки, зависящие от предыдущего состояния. */
  | { readonly code: 'memory'; readonly count: number }
  /** Есть ячейки X. */
  | { readonly code: 'unknown'; readonly count: number }
  /** Элементы с внутренним состоянием (`initialState`): считаются от начального состояния. */
  | { readonly code: 'stateful-elements'; readonly count: number }
  /** Элементы времени (`onTick`): таблица построена при t = 0, без тактов. */
  | { readonly code: 'time-elements'; readonly count: number }
  /** Неподключённые входы элементов читаются как 0. */
  | { readonly code: 'floating-inputs'; readonly count: number }
  | { readonly code: 'duplicate-labels'; readonly labels: readonly string[] }
  /** Ошибки компиляции схемы (повреждённые данные). */
  | { readonly code: 'diagnostics'; readonly count: number };

export interface TruthTable {
  readonly inputs: readonly InputPort[];
  readonly outputs: readonly TruthOutput[];
  /** 2ⁿ строк в порядке двоичного счёта; первый вход — старший разряд. */
  readonly rows: readonly TruthRow[];
  readonly warnings: readonly TruthTableWarning[];
}

export type TruthTableResult =
  | { readonly ok: true; readonly table: TruthTable }
  | { readonly ok: false; readonly reason: 'empty' | 'no-outputs' }
  | { readonly ok: false; readonly reason: 'too-many-inputs'; readonly inputCount: number; readonly limit: number };

export interface TruthTableOptions {
  readonly maxInputs?: number;
}

/** Биты строки: первый вход — старший разряд. */
export function rowBits(row: number, count: number): (0 | 1)[] {
  return Array.from({ length: count }, (_, i) => ((row >> (count - 1 - i)) & 1) as 0 | 1);
}

/**
 * Строит таблицу истинности на реальном движке симуляции.
 *
 * Схема компилируется один раз; каждая строка считается в отдельном экземпляре
 * `SimulationEngine`, поэтому основная симуляция, хранилища и схема не затрагиваются.
 *
 * Основной расчёт строки идёт от состояния «все сети X» (содержимое памяти неизвестно):
 * комбинационная часть и однозначно установленные петли получают 0 или 1, а значения,
 * зависящие от предыдущего состояния, остаются X. Если у выхода X, выполняется второй
 * расчёт от состояния включения: X и там — значение неопределённо (`unknown`),
 * иначе выход хранит предыдущее значение (`memory`).
 */
export function buildTruthTable(
  circuit: Circuit,
  registry: ElementRegistry,
  { maxInputs = MAX_TRUTH_TABLE_INPUTS }: TruthTableOptions = {},
): TruthTableResult {
  if (circuit.components.length === 0) return { ok: false, reason: 'empty' };
  const ports = findPorts(circuit, registry);
  if (ports.outputs.length === 0) return { ok: false, reason: 'no-outputs' };
  if (ports.inputs.length > maxInputs) {
    return { ok: false, reason: 'too-many-inputs', inputCount: ports.inputs.length, limit: maxInputs };
  }

  const netlist = compileCircuit(circuit, registry);
  // Входы и выходы, которых нет в netlist (повреждённые данные), отражены в `diagnostics`.
  const inputs = ports.inputs.filter((p) => netlist.componentIndex.has(p.componentId));
  const floating = new Set(findFloatingInputs(netlist).map(netIdOf));
  const outputs: TruthOutput[] = ports.outputs.map((port) => {
    const pin = outputPin(netlist, port);
    return { ...port, floating: pin === undefined || floating.has(netIdOf(pin)) };
  });

  const unknownStart: EngineState = {
    time: 0,
    nets: Object.fromEntries(netlist.netIds.map((id) => [id, UNKNOWN])),
    componentStates: {},
  };

  const run = (bits: readonly (0 | 1)[], initialState?: EngineState) => {
    const engine = new SimulationEngine(netlist, initialState ? { initialState } : {});
    inputs.forEach((port, i) => {
      engine.setProps(port.componentId, { ...engine.getProps(port.componentId), [port.prop]: bits[i] === 1 });
    });
    const { status } = engine.settle();
    const values = ports.outputs.map((port): Signal => {
      const pin = outputPin(netlist, port);
      return pin ? (engine.getPinValue(pin) ?? UNKNOWN) : UNKNOWN;
    });
    return { status, values };
  };

  const rows: TruthRow[] = [];
  for (let row = 0; row < 2 ** inputs.length; row++) {
    const bits = rowBits(row, inputs.length);
    const unknown = run(bits, unknownStart);
    let status: SettleStatus = unknown.status;
    let powerOn: readonly Signal[] | undefined;
    if (unknown.values.includes(UNKNOWN)) {
      const reset = run(bits);
      powerOn = reset.values;
      if (reset.status === 'oscillation') status = 'oscillation';
    }
    const cells = unknown.values.map((value, i): TruthCell => {
      if (value !== UNKNOWN) return { kind: 'value', value };
      const afterReset = powerOn![i]!;
      return afterReset === UNKNOWN ? { kind: 'unknown' } : { kind: 'memory', powerOn: afterReset };
    });
    rows.push({ inputs: bits, outputs: cells, unstable: status === 'oscillation' });
  }

  return { ok: true, table: { inputs, outputs, rows, warnings: collectWarnings(netlist, rows, ports.duplicateLabels) } };
}

/** Пин, значение которого показывает выход: первый вход элемента-индикатора. */
function outputPin(netlist: Netlist, port: OutputPort) {
  const index = netlist.componentIndex.get(port.componentId);
  const pin = index === undefined ? undefined : netlist.components[index]!.inputPins[0];
  return pin ? { componentId: port.componentId, pinId: pin.id } : undefined;
}

function collectWarnings(
  netlist: Netlist,
  rows: readonly TruthRow[],
  duplicateLabels: readonly string[],
): TruthTableWarning[] {
  const warnings: TruthTableWarning[] = [];
  const cells = rows.flatMap((r) => r.outputs);
  const count = (kind: TruthCell['kind']) => cells.filter((c) => c.kind === kind).length;
  const push = (code: 'memory' | 'unknown' | 'stateful-elements' | 'time-elements' | 'floating-inputs' | 'diagnostics', n: number) => {
    if (n > 0) warnings.push({ code, count: n });
  };

  push('memory', count('memory'));
  push('unknown', count('unknown'));
  const definitions = netlist.components.map((c) => c.definition);
  // Элементы времени сообщаются отдельно, даже если у них тоже есть состояние.
  push('stateful-elements', definitions.filter((d) => d.initialState && !d.onTick).length);
  push('time-elements', definitions.filter((d) => d.onTick).length);
  push('floating-inputs', findFloatingInputs(netlist).length);
  if (duplicateLabels.length > 0) warnings.push({ code: 'duplicate-labels', labels: duplicateLabels });
  push('diagnostics', netlist.diagnostics.length);
  return warnings;
}
