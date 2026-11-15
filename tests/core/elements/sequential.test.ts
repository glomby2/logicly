import { describe, expect, it } from 'vitest';
import {
  clockedValue,
  clockEdge,
  D_FLIP_FLOP,
  D_LATCH,
  JK_FLIP_FLOP,
  jkNext,
  rememberClock,
  T_FLIP_FLOP,
  type ClockMemory,
} from '@/core/elements';
import type { Signal } from '@/core/logic/signal';
import type { ElementDefinition } from '@/core/types/element';
import { knownCombinations, ternaryCombinations } from '../../helpers/combinations';

/*
 * Последовательные элементы: детектор фронта, триггеры, защёлка.
 * Проверки движка с несколькими триггерами — в tests/core/simulation/engine.sequential.test.ts.
 */

describe('детектор переднего фронта', () => {
  it.each<[ClockMemory, Signal, string]>([
    [null, 0, 'none'],
    [null, 1, 'none'],
    [null, 'X', 'none'],
    [0, 0, 'none'],
    [0, 1, 'rising'],
    [0, 'X', 'possible'],
    [1, 0, 'none'],
    [1, 1, 'none'],
    [1, 'X', 'possible'],
    ['X', 0, 'none'],
    ['X', 1, 'possible'],
    ['X', 'X', 'possible'],
  ])('было %s, стало %s → %s', (previous, current, edge) => {
    expect(clockEdge(previous, current)).toBe(edge);
  });

  it('монотонен по текущему уровню: X даёт possible или то же, что и все уточнения', () => {
    // possible ⊑ none и possible ⊑ rising: join(Q, next) уточняется и до Q, и до next.
    for (const previous of [null, 0, 1, 'X'] as ClockMemory[]) {
      const known = [clockEdge(previous, 0), clockEdge(previous, 1)];
      const vague = clockEdge(previous, 'X');
      expect(vague === 'possible' || known.every((e) => e === vague), `${previous}`).toBe(true);
    }
  });

  it('ненаблюдавшийся такт: X не запоминается, известный уровень — запоминается', () => {
    expect(rememberClock(null, 'X')).toBeNull();
    expect(rememberClock(null, 1)).toBe(1);
    expect(rememberClock(0, 'X')).toBe('X');
    expect(rememberClock('X', 0)).toBe(0);
  });

  it('новое Q: хранение, захват, join при возможном фронте', () => {
    expect(clockedValue('none', 1, 0)).toBe(1);
    expect(clockedValue('rising', 1, 0)).toBe(0);
    expect(clockedValue('possible', 1, 0)).toBe('X');
    expect(clockedValue('possible', 1, 1)).toBe(1);
  });
});

/** Последовательность вычислений элемента: входы по шагам → выходы после каждого шага. */
function trace(definition: ElementDefinition, steps: readonly (readonly Signal[])[]) {
  let state = definition.initialState!({});
  return steps.map((inputs) => {
    const result = definition.evaluate({ inputs, props: {}, state });
    state = result.state ?? state;
    return result.outputs.join('');
  });
}

describe('D FLIP-FLOP', () => {
  it('пины: D, CLK (тактовый) → Q, Q̄; категория «Триггеры и память»', () => {
    expect(D_FLIP_FLOP.pins({})).toEqual({
      inputs: [
        { id: 'd', label: 'D' },
        { id: 'clk', label: 'CLK', clock: true },
      ],
      outputs: [
        { id: 'q', label: 'Q' },
        { id: 'qn', label: 'Q̄' },
      ],
    });
    expect(D_FLIP_FLOP.category).toBe('sequential');
    expect(D_FLIP_FLOP.label).toBe('D FLIP-FLOP');
    expect(D_FLIP_FLOP.initialState!({})).toEqual({ q: 0, clk: null });
  });

  it('захватывает D только по переднему фронту', () => {
    // [D, CLK]
    expect(trace(D_FLIP_FLOP, [[1, 0], [1, 1], [0, 1], [0, 0], [0, 1], [1, 0]])).toEqual(['01', '10', '10', '10', '01', '01']);
  });

  it('первое вычисление при CLK = 1 — не фронт', () => {
    expect(trace(D_FLIP_FLOP, [[1, 1], [1, 1], [1, 0], [1, 1]])).toEqual(['01', '01', '01', '10']);
  });

  it('X на D по фронту — X; без фронта X на D не влияет', () => {
    expect(trace(D_FLIP_FLOP, [[0, 0], ['X', 0], ['X', 1]])).toEqual(['01', '01', 'XX']);
  });

  it('X на CLK: join(Q, D) — совпадает с D — значение сохраняется, иначе X', () => {
    expect(trace(D_FLIP_FLOP, [[0, 0], [0, 'X']])).toEqual(['01', '01']);
    expect(trace(D_FLIP_FLOP, [[1, 0], [1, 'X']])).toEqual(['01', 'XX']);
    // X на CLK сразу после включения — такт не наблюдался, фронта нет.
    expect(trace(D_FLIP_FLOP, [[1, 'X'], [1, 'X'], [1, 1]])).toEqual(['01', '01', '01']);
  });
});

describe('T FLIP-FLOP', () => {
  it('пины: T, CLK → Q, Q̄', () => {
    expect(T_FLIP_FLOP.pins({}).inputs.map((p) => [p.id, p.label, p.clock ?? false])).toEqual([
      ['t', 'T', false],
      ['clk', 'CLK', true],
    ]);
    expect(T_FLIP_FLOP.category).toBe('sequential');
  });

  it('T = 1 — переключение по каждому фронту, T = 0 — хранение', () => {
    // [T, CLK]
    expect(trace(T_FLIP_FLOP, [[1, 0], [1, 1], [1, 0], [1, 1], [0, 0], [0, 1], [1, 0], [1, 1]])).toEqual([
      '01', '10', '10', '01', '01', '01', '01', '10',
    ]);
  });

  it('X на T по фронту — X', () => {
    expect(trace(T_FLIP_FLOP, [[0, 0], ['X', 1]])).toEqual(['01', 'XX']);
  });
});

describe('JK FLIP-FLOP', () => {
  it('пины: J, CLK, K → Q, Q̄ (такт посередине)', () => {
    expect(JK_FLIP_FLOP.pins({}).inputs.map((p) => p.id)).toEqual(['j', 'clk', 'k']);
    expect(JK_FLIP_FLOP.pins({}).inputs[1]!.clock).toBe(true);
  });

  it('таблица по фронту: 00 — хранение, 01 — сброс, 10 — установка, 11 — переключение', () => {
    // Входы [J, CLK, K]; каждое действие — фронт 0 → 1.
    const edge = (j: Signal, k: Signal): Signal[][] => [
      [j, 0, k],
      [j, 1, k],
    ];
    const outputs = trace(JK_FLIP_FLOP, [...edge(1, 0), ...edge(0, 0), ...edge(1, 1), ...edge(1, 1), ...edge(0, 1), ...edge(0, 0)]);
    // После каждого фронта (нечётные позиции): установка 1, хранение 1, переключение 0, переключение 1, сброс 0, хранение 0.
    expect(outputs.filter((_, i) => i % 2 === 1)).toEqual(['10', '10', '01', '10', '01', '01']);
  });

  it('следующее Q — точное троичное значение на всех 27 наборах', () => {
    const exact = (j: Signal, k: Signal, q: Signal) => {
      const values = new Set<Signal>();
      for (const [jv, kv, qv] of knownCombinations(3)) {
        if ((j === 'X' || j === jv) && (k === 'X' || k === kv) && (q === 'X' || q === qv)) {
          values.add(jv && kv ? (qv ? 0 : 1) : jv ? 1 : kv ? 0 : qv);
        }
      }
      return values.size === 1 ? [...values][0]! : 'X';
    };
    for (const [j, k, q] of ternaryCombinations(3)) {
      expect(jkNext(j!, k!, q!), `J=${j} K=${k} Q=${q}`).toBe(exact(j!, k!, q!));
    }
    // Установка и сброс определены и при неизвестном Q.
    expect(jkNext(1, 0, 'X')).toBe(1);
    expect(jkNext(0, 1, 'X')).toBe(0);
    expect(jkNext(1, 1, 'X')).toBe('X');
  });
});

describe('D LATCH', () => {
  it('пины: D, E → Q, Q̄; тактового входа нет', () => {
    const { inputs, outputs } = D_LATCH.pins({});
    expect(inputs.map((p) => [p.id, p.label])).toEqual([
      ['d', 'D'],
      ['e', 'E'],
    ]);
    expect(inputs.some((p) => p.clock)).toBe(false);
    expect(outputs.map((p) => p.label)).toEqual(['Q', 'Q̄']);
    expect(D_LATCH.category).toBe('sequential');
  });

  it('E = 1 — прозрачна, E = 0 — хранит', () => {
    // [D, E]
    expect(trace(D_LATCH, [[1, 0], [1, 1], [0, 1], [1, 1], [1, 0], [0, 0], [0, 1]])).toEqual([
      '01', '10', '01', '10', '10', '10', '01',
    ]);
  });

  it('E = X: join(Q, D)', () => {
    expect(trace(D_LATCH, [[0, 0], [0, 'X'], [1, 'X']])).toEqual(['01', '01', 'XX']);
    expect(trace(D_LATCH, [['X', 1]])).toEqual(['XX']);
  });
});
