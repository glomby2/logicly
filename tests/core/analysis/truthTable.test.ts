import { describe, expect, it } from 'vitest';
import { buildTruthTable, MAX_TRUTH_TABLE_INPUTS, rowBits, type TruthCell, type TruthTable } from '@/core/analysis';
import { createDefaultRegistry, type ElementRegistry } from '@/core/elements';
import type { Circuit } from '@/core/types/circuit';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import {
  enabledRingOscillator,
  halfAdder,
  inverterRing,
  muxDLatch,
  nandDLatch,
  nandLatch,
  norLatch,
  rippleCarryAdder,
} from '../../helpers/circuits';
import { TEST_CLOCK, TEST_DFF } from '../../helpers/fixtureElements';
import { createRandom } from '../../helpers/simulation';

const registry = createDefaultRegistry();

/**
 * Подписывает INPUT и OUTPUT их id (подпись задаёт порядок столбцов) и добавляет
 * индикаторы на выходы `sources`: OUTPUT `out_Q` с подписью `Q`.
 */
function observe(b: CircuitBuilder, ...sources: string[]): Circuit {
  for (const source of sources) b.output(`out_${source}`).wire(source, `out_${source}`);
  const circuit = b.build();
  return {
    ...circuit,
    components: circuit.components.map((c) =>
      c.type === 'INPUT' || c.type === 'OUTPUT' ? { ...c, label: c.id.replace(/^out_/, '') } : c,
    ),
  };
}

function table(circuit: Circuit, reg: ElementRegistry = registry): TruthTable {
  const result = buildTruthTable(circuit, reg);
  if (!result.ok) throw new Error(`Таблица не построена: ${result.reason}`);
  return result.table;
}

const cellText = (cell: TruthCell) =>
  cell.kind === 'value' ? String(cell.value) : cell.kind === 'unknown' ? 'X' : `↺${cell.powerOn}`;

/** Строки в виде `входы|выходы`: «01|10», ячейка памяти — «↺0» (значение после сброса). */
const rows = (t: TruthTable) => t.rows.map((r) => `${r.inputs.join('')}|${r.outputs.map(cellText).join(' ')}`);
const labels = (t: TruthTable) => [t.inputs.map((p) => p.label), t.outputs.map((p) => p.label)];
const codes = (t: TruthTable) => t.warnings.map((w) => w.code);

/** Глубокая заморозка: попытка изменить схему внутри построения таблицы бросит исключение. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('порядок комбинаций', () => {
  it('двоичный счёт, первый вход — старший разряд', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((r) => rowBits(r, 3).join(''))).toEqual([
      '000', '001', '010', '011', '100', '101', '110', '111',
    ]);
    expect(rowBits(0, 0)).toEqual([]);
  });
});

describe('комбинационные схемы', () => {
  it('полусумматор', () => {
    const t = table(observe(halfAdder()));
    expect(labels(t)).toEqual([['A', 'B'], ['CARRY', 'SUM']]);
    expect(rows(t)).toEqual(['00|0 0', '01|0 1', '10|0 1', '11|1 0']);
    expect(t.warnings).toEqual([]);
    expect(t.rows.every((r) => !r.unstable)).toBe(true);
  });

  it('полный сумматор: S = A ⊕ B ⊕ Cin, Cout — большинство', () => {
    const t = table(observe(rippleCarryAdder(1)));
    expect(labels(t)).toEqual([['A0', 'B0', 'CIN'], ['COUT', 'S0']]);
    for (const row of t.rows) {
      const sum = row.inputs.reduce<number>((acc, bit) => acc + bit, 0);
      expect(row.outputs).toEqual([
        { kind: 'value', value: sum >= 2 ? 1 : 0 },
        { kind: 'value', value: sum % 2 },
      ]);
    }
    expect(t.rows).toHaveLength(8);
  });

  it('8-входовой XOR — чётность', () => {
    const b = new CircuitBuilder().gate('G', 'XOR', 8);
    for (let i = 0; i < 8; i++) b.input(`I${i}`).wire(`I${i}`, `G.in${i}`);
    const t = table(observe(b, 'G'));
    expect(t.rows).toHaveLength(256);
    for (const row of t.rows) {
      const parity = row.inputs.reduce<number>((acc, bit) => acc ^ bit, 0);
      expect(row.outputs).toEqual([{ kind: 'value', value: parity }]);
    }
  });

  it('несколько выходов от одного входа', () => {
    const t = table(observe(new CircuitBuilder().input('A').gate('N', 'NOT').wire('A', 'N'), 'A', 'N'));
    expect(labels(t)).toEqual([['A'], ['A', 'N']]);
    expect(rows(t)).toEqual(['0|0 1', '1|1 0']);
  });
});

describe('особые случаи', () => {
  it('пустая схема', () => {
    expect(buildTruthTable({ components: [], wires: [] }, registry)).toEqual({ ok: false, reason: 'empty' });
  });

  it('нет выходов', () => {
    expect(buildTruthTable(new CircuitBuilder().input('A').gate('N', 'NOT').wire('A', 'N').build(), registry)).toEqual({
      ok: false,
      reason: 'no-outputs',
    });
  });

  it('нет входов — одна строка с постоянными значениями', () => {
    const t = table(observe(new CircuitBuilder().gate('N', 'NOT'), 'N'));
    expect(t.inputs).toEqual([]);
    expect(rows(t)).toEqual(['|1']);
  });

  it('неподключённый выход: значение 0, столбец помечен', () => {
    const t = table(observe(new CircuitBuilder().input('A').output('Y')));
    expect(rows(t)).toEqual(['0|0', '1|0']);
    expect(t.outputs[0]!.floating).toBe(true);
    expect(t.warnings).toEqual([{ code: 'floating-inputs', count: 1 }]);
  });

  it(`лимит: ${MAX_TRUTH_TABLE_INPUTS} входов строятся, ${MAX_TRUTH_TABLE_INPUTS + 1} — нет`, () => {
    const make = (n: number) => {
      const b = new CircuitBuilder().gate('G', 'AND', 8).output('Y').wire('G', 'Y');
      for (let i = 0; i < n; i++) b.input(`I${i}`);
      return b.build();
    };
    const ok = buildTruthTable(make(MAX_TRUTH_TABLE_INPUTS), registry);
    expect(ok.ok && ok.table.rows.length).toBe(2 ** MAX_TRUTH_TABLE_INPUTS);
    expect(buildTruthTable(make(MAX_TRUTH_TABLE_INPUTS + 1), registry)).toEqual({
      ok: false,
      reason: 'too-many-inputs',
      inputCount: MAX_TRUTH_TABLE_INPUTS + 1,
      limit: MAX_TRUTH_TABLE_INPUTS,
    });
    expect(buildTruthTable(make(3), registry, { maxInputs: 2 })).toMatchObject({ ok: false, inputCount: 3, limit: 2 });
  });
});

describe('схемы с памятью', () => {
  it('RS-защёлка на NOR: хранение при S = R = 0, установка, сброс, запрещённое состояние', () => {
    const t = table(observe(norLatch(), 'Q', 'QN'));
    expect(labels(t)).toEqual([['R', 'S'], ['Q', 'QN']]);
    // Значение после сброса (↺0, ↺1) — лишь справка: в строке хранения выход зависит от прошлого.
    expect(rows(t)).toEqual(['00|↺0 ↺1', '01|1 0', '10|0 1', '11|0 0']);
    expect(t.warnings).toEqual([{ code: 'memory', count: 2 }]);
  });

  it('RS-защёлка на NAND: хранение при S̄ = R̄ = 1', () => {
    const t = table(observe(nandLatch(), 'Q', 'QN'));
    expect(labels(t)).toEqual([['RN', 'SN'], ['Q', 'QN']]);
    // Строки: R̄S̄ = 00 (запрещённое), 01 (сброс R̄ = 0), 10 (установка S̄ = 0), 11 (хранение).
    const [both0, reset, set, hold] = t.rows;
    expect(both0!.outputs).toEqual([{ kind: 'value', value: 1 }, { kind: 'value', value: 1 }]);
    expect(reset!.outputs).toEqual([{ kind: 'value', value: 0 }, { kind: 'value', value: 1 }]);
    expect(set!.outputs).toEqual([{ kind: 'value', value: 1 }, { kind: 'value', value: 0 }]);
    expect(hold!.outputs.map((c) => c.kind)).toEqual(['memory', 'memory']);
  });

  it.each([
    ['на NAND', nandDLatch()],
    ['на мультиплексоре', muxDLatch()],
    ['на мультиплексоре без согласующего терма', muxDLatch({ consensus: false })],
  ])('D-защёлка %s: E = 0 — хранение, E = 1 — Q = D', (_, latch) => {
    const t = table(observe(latch, 'Q'));
    expect(labels(t)).toEqual([['D', 'E'], ['Q']]);
    const [d0e0, d0e1, d1e0, d1e1] = t.rows;
    expect(d0e0!.outputs[0]!.kind).toBe('memory');
    expect(d1e0!.outputs[0]!.kind).toBe('memory');
    expect(d0e1!.outputs[0]).toEqual({ kind: 'value', value: 0 });
    expect(d1e1!.outputs[0]).toEqual({ kind: 'value', value: 1 });
  });

  it('кольцо из двух инверторов — защёлка без входов', () => {
    const t = table(observe(inverterRing(2), 'N0'));
    expect(t.rows[0]!.outputs[0]!.kind).toBe('memory');
    expect(t.rows[0]!.unstable).toBe(false);
  });
});

describe('MUX и DEMUX', () => {
  it('MUX 2:1: Y = D[S]', () => {
    const b = new CircuitBuilder().input('D0').input('D1').input('S').add('M', 'MUX', { selectBits: 1 });
    b.wire('D0', 'M.d0').wire('D1', 'M.d1').wire('S', 'M.s0').output('Y').wire('M.y', 'Y');
    const t = table(observe(b));
    expect(labels(t)).toEqual([['D0', 'D1', 'S'], ['Y']]);
    expect(rows(t)).toEqual(['000|0', '001|0', '010|0', '011|1', '100|1', '101|0', '110|1', '111|1']);
    expect(t.warnings).toEqual([]);
  });

  it('DEMUX 1:2: D на выход по адресу, второй выход 0', () => {
    const b = new CircuitBuilder().input('D').input('S').add('X', 'DEMUX', { selectBits: 1 });
    b.wire('D', 'X.d').wire('S', 'X.s0').output('Y0').output('Y1').wire('X.y0', 'Y0').wire('X.y1', 'Y1');
    const t = table(observe(b));
    expect(labels(t)).toEqual([['D', 'S'], ['Y0', 'Y1']]);
    expect(rows(t)).toEqual(['00|0 0', '01|0 0', '10|1 0', '11|0 1']);
  });

  it('MUX 4:1: все 64 комбинации совпадают с эталоном', () => {
    const b = new CircuitBuilder().add('M', 'MUX', { selectBits: 2 });
    // Подписи A…F задают порядок столбцов: D0…D3, затем S0, S1.
    const pins = ['d0', 'd1', 'd2', 'd3', 's0', 's1'];
    pins.forEach((pinId, i) => b.input(String.fromCharCode(65 + i)).wire(String.fromCharCode(65 + i), `M.${pinId}`));
    const t = table(observe(b.output('Y').wire('M.y', 'Y')));
    expect(t.rows).toHaveLength(64);
    for (const row of t.rows) {
      const [d0, d1, d2, d3, s0, s1] = row.inputs;
      expect(row.outputs, row.inputs.join('')).toEqual([{ kind: 'value', value: [d0, d1, d2, d3][s0! + 2 * s1!] }]);
    }
  });

  it('D-защёлка на элементе MUX (Y → D0, D → D1, E → S): E = 0 — хранение, E = 1 — Q = D', () => {
    const b = new CircuitBuilder().input('D').input('E').add('M', 'MUX', { selectBits: 1 });
    b.wire('M.y', 'M.d0').wire('D', 'M.d1').wire('E', 'M.s0').output('Q').wire('M.y', 'Q');
    const t = table(observe(b));
    expect(rows(t)).toEqual(['00|↺0', '01|0', '10|↺0', '11|1']);
    expect(t.warnings).toEqual([{ code: 'memory', count: 2 }]);
  });
});

describe('неопределённые значения X', () => {
  it('NOT на себя — X, строка нестабильна', () => {
    const t = table(observe(new CircuitBuilder().gate('N', 'NOT').wire('N', 'N'), 'N'));
    expect(rows(t)).toEqual(['|X']);
    expect(t.rows[0]!.unstable).toBe(true);
    expect(t.warnings).toEqual([{ code: 'unknown', count: 1 }]);
  });

  it('кольцо из трёх инверторов — X', () => {
    expect(rows(table(observe(inverterRing(3), 'N0', 'N1', 'N2')))).toEqual(['|X X X']);
  });

  it('генератор с разрешением: EN = 0 — определено, EN = 1 — колебание', () => {
    const t = table(observe(enabledRingOscillator(), 'G'));
    expect(rows(t)).toEqual(['0|1', '1|X']);
    expect(t.rows.map((r) => r.unstable)).toEqual([false, true]);
  });

  it('X не распространяется на независимую часть схемы', () => {
    const b = enabledRingOscillator().input('A').gate('NA', 'NOT').wire('A', 'NA');
    const t = table(observe(b, 'G', 'NA'));
    expect(labels(t)).toEqual([['A', 'EN'], ['G', 'NA']]);
    expect(rows(t)).toEqual(['00|1 1', '01|X 1', '10|1 0', '11|X 0']);
  });
});

describe('предупреждения', () => {
  it('элементы с внутренним состоянием считаются от начального состояния', () => {
    const reg = createDefaultRegistry();
    reg.register(TEST_DFF);
    const b = new CircuitBuilder().input('D').input('C').add('F', 'TEST_DFF').wire('D', 'F.d').wire('C', 'F.clk');
    const t = table(observe(b.output('Q').wire('F.q', 'Q')), reg);
    expect(codes(t)).toEqual(['stateful-elements']);
    expect(t.rows.every((r) => r.outputs[0]!.kind === 'value')).toBe(true);
  });

  it('элементы времени: таблица при t = 0', () => {
    const reg = createDefaultRegistry();
    reg.register(TEST_CLOCK);
    const t = table(observe(new CircuitBuilder().add('CLK', 'TEST_CLOCK'), 'CLK'), reg);
    expect(t.warnings).toEqual([{ code: 'time-elements', count: 1 }]);
    expect(rows(t)).toEqual(['|0']);
  });

  it('неподключённые входы вентилей', () => {
    const t = table(observe(new CircuitBuilder().input('A').gate('G', 'AND', 3).wire('A', 'G.in0'), 'G'));
    expect(t.warnings).toEqual([{ code: 'floating-inputs', count: 2 }]);
  });

  it('повторяющиеся подписи', () => {
    const circuit = observe(new CircuitBuilder().input('A').input('B').gate('G', 'OR').wire('A', 'G.in0').wire('B', 'G.in1'), 'G');
    const duplicated = { ...circuit, components: circuit.components.map((c) => (c.id === 'B' ? { ...c, label: 'A' } : c)) };
    const t = table(duplicated);
    expect(t.warnings).toEqual([{ code: 'duplicate-labels', labels: ['A'] }]);
    expect(t.inputs.map((p) => p.componentId)).toEqual(['A', 'B']);
  });

  it('диагностика компиляции повреждённой схемы', () => {
    const circuit = observe(new CircuitBuilder().input('A').gate('N', 'NOT').wire('A', 'N'), 'N');
    const broken = { ...circuit, wires: [...circuit.wires, { id: 'bad', from: { componentId: 'ghost', pinId: 'out0' }, to: { componentId: 'N', pinId: 'in0' } }] };
    const t = table(broken);
    expect(codes(t)).toEqual(['diagnostics']);
    expect(rows(t)).toEqual(['0|1', '1|0']);
  });

  it('порядок предупреждений фиксирован', () => {
    const b = new CircuitBuilder().gate('N', 'NOT').wire('N', 'N').input('A').gate('G', 'AND').wire('A', 'G.in0');
    const t = table(observe(b, 'N', 'G'));
    expect(codes(t)).toEqual(['unknown', 'floating-inputs']);
  });
});

describe('чистота и детерминированность', () => {
  it('схема не изменяется, повторное построение даёт тот же результат', () => {
    const circuit = deepFreeze(observe(norLatch(), 'Q', 'QN'));
    const first = buildTruthTable(circuit, registry);
    expect(buildTruthTable(circuit, registry)).toEqual(first);
  });

  it('положения INPUT в схеме не влияют на таблицу', () => {
    const off = observe(halfAdder());
    const on = { ...off, components: off.components.map((c) => (c.type === 'INPUT' ? { ...c, props: { value: true } } : c)) };
    expect(buildTruthTable(on, registry)).toEqual(buildTruthTable(off, registry));
  });
});

describe('производительность', () => {
  it('10 входов и 300 вентилей с петлями строятся быстро', () => {
    const random = createRandom(7);
    const b = new CircuitBuilder();
    const sources: string[] = [];
    for (let i = 0; i < 10; i++) {
      b.input(`I${i}`);
      sources.push(`I${i}`);
    }
    for (let g = 0; g < 300; g++) {
      b.gate(`G${g}`, ['AND', 'OR', 'NAND', 'NOR', 'XOR'][g % 5]!);
      // Входы — из более ранних источников и изредка из более поздних вентилей (петли).
      const pick = () => (random() < 0.05 ? `G${Math.floor(random() * 300)}` : sources[Math.floor(random() * sources.length)]!);
      b.wire(pick(), `G${g}.in0`).wire(pick(), `G${g}.in1`);
      sources.push(`G${g}`);
    }
    const circuit = observe(b, 'G299', 'G298', 'G150');

    const start = performance.now();
    const result = buildTruthTable(circuit, registry);
    const elapsed = performance.now() - start;
    expect(result.ok && result.table.rows).toHaveLength(1024);
    // Мягкий порог: обычно в десятки раз быстрее.
    expect(elapsed).toBeLessThan(5000);
  });
});
