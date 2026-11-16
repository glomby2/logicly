import { describe, expect, it } from 'vitest';
import {
  CODE_BITS_SPEC,
  DECODER,
  ENCODER,
  MAX_CODE_BITS,
  MIN_CODE_BITS,
  PRIORITY_ENCODER,
  resolveProps,
} from '@/core/elements';
import type { KnownSignal, Signal } from '@/core/logic/signal';
import type { ElementDefinition } from '@/core/types/element';
import { knownCombinations, ternaryCombinations } from '../../helpers/combinations';
import { exactExtension } from '../../helpers/exactExtension';

/*
 * Элементы двоичного кода: DECODER (код → позиционный), ENCODER и PRIORITY ENCODER (позиционный → код).
 * Порядок входов и выходов — как в pins(); a0 — младший разряд кода.
 */

const BITS = [MIN_CODE_BITS, MAX_CODE_BITS] as const;
const ELEMENTS = [DECODER, ENCODER, PRIORITY_ENCODER] as const;

const run = (definition: ElementDefinition, codeBits: number, inputs: readonly Signal[]) =>
  definition.evaluate({ inputs, props: { codeBits }, state: undefined }).outputs;

/** Число по разрядам: первый — младший. */
const toNumber = (bits: readonly KnownSignal[]) => bits.reduce<number>((sum, bit, i) => sum + bit * 2 ** i, 0);
/** Разряды числа: первый — младший. */
const toBits = (value: number, count: number): KnownSignal[] =>
  Array.from({ length: count }, (_, i) => ((value >> i) & 1) as KnownSignal);

const decoderReference = (bits: number) => (inputs: readonly KnownSignal[]) =>
  Array.from({ length: 2 ** bits }, (_, line): KnownSignal => (line === toNumber(inputs) ? 1 : 0));

const encoderReference = (bits: number) => (inputs: readonly KnownSignal[]) =>
  toBits(inputs.reduce<number>((code, d, line) => (d === 1 ? code | line : code), 0), bits);

const priorityReference = (bits: number) => (inputs: readonly KnownSignal[]): KnownSignal[] => {
  const winner = inputs.lastIndexOf(1);
  return winner < 0 ? [...toBits(0, bits), 0] : [...toBits(winner, bits), 1];
};

const REFERENCES = new Map<ElementDefinition, (bits: number) => (inputs: readonly KnownSignal[]) => readonly Signal[]>([
  [DECODER, decoderReference],
  [ENCODER, encoderReference],
  [PRIORITY_ENCODER, priorityReference],
]);

/** Позиционный код: 1 на линии `line` из `count`. */
const oneHot = (line: number, count: number): KnownSignal[] => Array.from({ length: count }, (_, i) => (i === line ? 1 : 0));

describe.each(ELEMENTS.map((d) => [d.type, d] as const))('%s: общие свойства', (_, definition) => {
  const reference = REFERENCES.get(definition)!;

  it('по умолчанию 2 разряда, свойство «Разрядность кода» 2–3, категория комбинационных схем', () => {
    expect(definition.defaultProps).toEqual({ codeBits: 2 });
    expect(definition.propSchema).toEqual([CODE_BITS_SPEC]);
    expect(CODE_BITS_SPEC).toMatchObject({ key: 'codeBits', kind: 'integer', min: 2, max: 3 });
    expect(definition.category).toBe('combinational');
    expect(definition.port).toBeUndefined();
    expect(definition.labelPrefix).toBeUndefined();
    expect(definition.initialState).toBeUndefined();
  });

  it('неверная разрядность нормализуется при разборе свойств', () => {
    expect(resolveProps(definition, { codeBits: 1 })).toEqual({ codeBits: 2 });
    expect(resolveProps(definition, { codeBits: 4 })).toEqual({ codeBits: 3 });
    expect(resolveProps(definition, { codeBits: 2.6 })).toEqual({ codeBits: 3 });
    expect(resolveProps(definition, { codeBits: Number.NaN })).toEqual({ codeBits: 2 });
    expect(resolveProps(definition, { codeBits: '3' } as never)).toEqual({ codeBits: 2 });
  });

  it('id пинов стабильны при смене разрядности: пины варианта 2 сохраняются в варианте 3', () => {
    const ids = (bits: number) => {
      const { inputs, outputs } = definition.pins({ codeBits: bits });
      return [...inputs, ...outputs].map((p) => p.id);
    };
    expect(ids(3)).toEqual(expect.arrayContaining(ids(2)));
  });

  it.each(BITS)('%i разряда: все двоичные наборы совпадают с эталоном', (bits) => {
    const count = definition.pins({ codeBits: bits }).inputs.length;
    for (const inputs of knownCombinations(count)) {
      expect(run(definition, bits, inputs), inputs.join('')).toEqual(reference(bits)(inputs));
    }
  });

  it.each(BITS)('%i разряда: на всех троичных наборах — точное троичное расширение', (bits) => {
    const count = definition.pins({ codeBits: bits }).inputs.length;
    for (const inputs of ternaryCombinations(count)) {
      const actual = run(definition, bits, inputs);
      const expected = exactExtension(reference(bits), inputs);
      // expect — только при расхождении: 3⁸ наборов.
      if (actual.some((v, i) => v !== expected[i])) expect(actual, inputs.join('')).toEqual(expected);
    }
  });
});

describe('DECODER', () => {
  it('пины: код a0…a(n−1), выходы y0…y(2ⁿ−1); конфигурация 2:4 и 3:8', () => {
    expect(DECODER.pins({ codeBits: 2 })).toEqual({
      inputs: [
        { id: 'a0', label: 'A0' },
        { id: 'a1', label: 'A1' },
      ],
      outputs: [0, 1, 2, 3].map((i) => ({ id: `y${i}`, label: `Y${i}` })),
    });
    expect(DECODER.pins({ codeBits: 3 }).outputs.map((p) => p.id)).toEqual(['y0', 'y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7']);
    expect(BITS.map((bits) => DECODER.variant!({ codeBits: bits }))).toEqual(['2:4', '3:8']);
  });

  it.each(BITS)('%i разряда: при известном коде ровно одна 1 — на выходе с номером кода', (bits) => {
    for (const code of knownCombinations(bits)) {
      const outputs = run(DECODER, bits, code);
      expect(outputs.filter((v) => v === 1)).toHaveLength(1);
      expect(outputs.indexOf(1)).toBe(toNumber(code));
    }
  });

  it('X в коде: возможные выходы X, исключённые известным разрядом — 0', () => {
    expect(run(DECODER, 2, ['X', 0])).toEqual(['X', 'X', 0, 0]);
    expect(run(DECODER, 2, [1, 'X'])).toEqual([0, 'X', 0, 'X']);
    expect(run(DECODER, 2, ['X', 'X'])).toEqual(['X', 'X', 'X', 'X']);
    expect(run(DECODER, 3, [1, 'X', 1])).toEqual([0, 0, 0, 0, 0, 'X', 0, 'X']);
  });

  it('неподключённые входы читаются как 0: Y0 = 1', () => {
    expect(run(DECODER, 2, [])).toEqual([1, 0, 0, 0]);
    expect(run(DECODER, 3, [])).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('ENCODER', () => {
  it('пины: входы d0…d(2ⁿ−1), код a0…a(n−1); конфигурация 4:2 и 8:3', () => {
    expect(ENCODER.pins({ codeBits: 2 })).toEqual({
      inputs: [0, 1, 2, 3].map((i) => ({ id: `d${i}`, label: `D${i}` })),
      outputs: [
        { id: 'a0', label: 'A0' },
        { id: 'a1', label: 'A1' },
      ],
    });
    expect(ENCODER.pins({ codeBits: 3 }).outputs.map((p) => p.id)).toEqual(['a0', 'a1', 'a2']);
    expect(BITS.map((bits) => ENCODER.variant!({ codeBits: bits }))).toEqual(['4:2', '8:3']);
  });

  it.each(BITS)('%i разряда: позиционный код даёт номер активного входа', (bits) => {
    const count = 2 ** bits;
    for (let line = 0; line < count; line++) {
      expect(run(ENCODER, bits, oneHot(line, count))).toEqual(toBits(line, bits));
    }
  });

  it('4:2: A0 = D1 + D3, A1 = D2 + D3', () => {
    for (const [d0, d1, d2, d3] of knownCombinations(4)) {
      expect(run(ENCODER, 2, [d0!, d1!, d2!, d3!])).toEqual([d1 || d3 ? 1 : 0, d2 || d3 ? 1 : 0]);
    }
  });

  it.each(BITS)('%i разряда: D0 на выход не влияет ни при каких остальных входах', (bits) => {
    for (const rest of ternaryCombinations(2 ** bits - 1)) {
      expect(run(ENCODER, bits, [0, ...rest])).toEqual(run(ENCODER, bits, [1, ...rest]));
      expect(run(ENCODER, bits, ['X', ...rest])).toEqual(run(ENCODER, bits, [0, ...rest]));
    }
  });

  it('несколько активных входов — побитовое ИЛИ номеров, без X', () => {
    expect(run(ENCODER, 2, [0, 1, 1, 0])).toEqual([1, 1]);
    expect(run(ENCODER, 3, [0, 1, 0, 0, 1, 0, 0, 0])).toEqual([1, 0, 1]);
  });

  it('X: OR по Клини — известная 1 в разряде определяет его', () => {
    expect(run(ENCODER, 2, [0, 1, 0, 'X'])).toEqual([1, 'X']);
    expect(run(ENCODER, 2, [0, 0, 0, 'X'])).toEqual(['X', 'X']);
    expect(run(ENCODER, 2, [0, 0, 'X', 0])).toEqual([0, 'X']);
  });

  it('неподключённые входы читаются как 0: код 0', () => {
    expect(run(ENCODER, 2, [])).toEqual([0, 0]);
    expect(run(ENCODER, 3, [])).toEqual([0, 0, 0]);
  });
});

describe('PRIORITY ENCODER', () => {
  it('пины: входы d0…, код a0…, затем V; конфигурация 4:2 и 8:3 (V не учитывается)', () => {
    expect(PRIORITY_ENCODER.pins({ codeBits: 2 })).toEqual({
      inputs: [0, 1, 2, 3].map((i) => ({ id: `d${i}`, label: `D${i}` })),
      outputs: [
        { id: 'a0', label: 'A0' },
        { id: 'a1', label: 'A1' },
        { id: 'v', label: 'V' },
      ],
    });
    expect(PRIORITY_ENCODER.pins({ codeBits: 3 }).outputs.map((p) => p.id)).toEqual(['a0', 'a1', 'a2', 'v']);
    expect(BITS.map((bits) => PRIORITY_ENCODER.variant!({ codeBits: bits }))).toEqual(['4:2', '8:3']);
  });

  it.each(BITS)('%i разряда: несколько активных входов — номер старшего, V = 1', (bits) => {
    const count = 2 ** bits;
    for (const inputs of knownCombinations(count)) {
      const highest = inputs.lastIndexOf(1);
      if (highest < 0) continue;
      expect(run(PRIORITY_ENCODER, bits, inputs), inputs.join('')).toEqual([...toBits(highest, bits), 1]);
    }
  });

  it.each(BITS)('%i разряда: V — OR входов по Клини на всех троичных наборах', (bits) => {
    const count = 2 ** bits;
    for (const inputs of ternaryCombinations(count)) {
      const v = run(PRIORITY_ENCODER, bits, inputs)[bits];
      const expected = inputs.includes(1) ? 1 : inputs.includes('X') ? 'X' : 0;
      if (v !== expected) expect(v, inputs.join('')).toBe(expected);
    }
  });

  // Входы в таблицах ТЗ записаны как D3 D2 D1 D0; здесь — в порядке пинов (D0 первым).
  it.each<[string, Signal[], Signal[]]>([
    ['нет активных', [0, 0, 0, 0], [0, 0, 0]],
    ['только D0', [1, 0, 0, 0], [0, 0, 1]],
    ['D1 и D3 → 3', [0, 1, 0, 1], [1, 1, 1]],
    ['D3 = X, D2 = 1', [0, 0, 1, 'X'], ['X', 1, 1]],
    ['D3 = X, D1 = 1', [0, 1, 0, 'X'], [1, 'X', 1]],
    ['только D1 = X', [0, 'X', 0, 0], ['X', 0, 'X']],
    ['D2 = X, D0 = X', ['X', 0, 'X', 0], [0, 'X', 'X']],
    ['все X', ['X', 'X', 'X', 'X'], ['X', 'X', 'X']],
  ])('4:2, %s', (_, inputs, expected) => {
    expect(run(PRIORITY_ENCODER, 2, inputs)).toEqual(expected);
  });

  it('неподключённые входы читаются как 0: A = 0, V = 0', () => {
    expect(run(PRIORITY_ENCODER, 2, [])).toEqual([0, 0, 0]);
    expect(run(PRIORITY_ENCODER, 3, [])).toEqual([0, 0, 0, 0]);
  });
});

describe('композиции', () => {
  it.each(BITS)('%i разряда: ENCODER(DECODER(a)) = a; PRIORITY ENCODER(DECODER(a)) = (a, V = 1)', (bits) => {
    for (const code of knownCombinations(bits)) {
      const lines = run(DECODER, bits, code);
      expect(run(ENCODER, bits, lines)).toEqual(code);
      expect(run(PRIORITY_ENCODER, bits, lines)).toEqual([...code, 1]);
    }
  });
});
