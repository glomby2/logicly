import { describe, expect, it } from 'vitest';
import { and, join, not, or, xor } from '@/core/logic/ops';
import { fromBoolean, isKnown, type Signal } from '@/core/logic/signal';
import { refines, ternaryCombinations } from '../../helpers/combinations';

describe('not', () => {
  it.each<[Signal, Signal]>([
    [0, 1],
    [1, 0],
    ['X', 'X'],
  ])('not(%s) = %s', (input, expected) => {
    expect(not(input)).toBe(expected);
  });
});

describe('and / or / xor — таблицы Клини для двух входов', () => {
  // Строки: a, столбцы: b в порядке 0, 1, X.
  const cases: Record<string, [(i: Signal[]) => Signal, Signal[][]]> = {
    and: [
      and,
      [
        [0, 0, 0],
        [0, 1, 'X'],
        [0, 'X', 'X'],
      ],
    ],
    or: [
      or,
      [
        [0, 1, 'X'],
        [1, 1, 1],
        ['X', 1, 'X'],
      ],
    ],
    xor: [
      xor,
      [
        [0, 1, 'X'],
        [1, 0, 'X'],
        ['X', 'X', 'X'],
      ],
    ],
  };
  const values: Signal[] = [0, 1, 'X'];

  for (const [name, [op, table]] of Object.entries(cases)) {
    it(name, () => {
      values.forEach((a, row) =>
        values.forEach((b, col) => {
          expect(op([a, b]), `${name}(${a}, ${b})`).toBe(table[row]![col]);
        }),
      );
    });
  }
});

describe('n-арные операции', () => {
  it('and: 1 только когда все входы 1', () => {
    expect(and([1, 1, 1, 1])).toBe(1);
    expect(and([1, 1, 0, 1])).toBe(0);
    expect(and([1, 'X', 0])).toBe(0);
    expect(and([1, 'X', 1])).toBe('X');
  });

  it('or: 1 если хотя бы один вход 1', () => {
    expect(or([0, 0, 0])).toBe(0);
    expect(or([0, 'X', 1])).toBe(1);
    expect(or([0, 'X', 0])).toBe('X');
  });

  it('xor: чётность числа единиц', () => {
    expect(xor([1, 1, 1])).toBe(1);
    expect(xor([1, 1, 0, 0])).toBe(0);
    expect(xor([1, 0, 0, 0])).toBe(1);
  });

  it('пустой список входов даёт нейтральный элемент', () => {
    expect(and([])).toBe(1);
    expect(or([])).toBe(0);
    expect(xor([])).toBe(0);
  });
});

describe('join', () => {
  it('сохраняет совпадающие значения и даёт X для различающихся', () => {
    expect(join(0, 0)).toBe(0);
    expect(join(1, 1)).toBe(1);
    expect(join(0, 1)).toBe('X');
    expect(join(1, 'X')).toBe('X');
    expect(join('X', 'X')).toBe('X');
  });
});

describe('монотонность по X', () => {
  const ops = { and, or, xor, not: (inputs: Signal[]) => not(inputs[0]!) };
  for (const [name, op] of Object.entries(ops)) {
    it(name, () => {
      const arity = name === 'not' ? 1 : 3;
      const all = ternaryCombinations(arity);
      for (const precise of all) {
        for (const vague of all) {
          if (!refines(precise, vague)) continue;
          const exact = op(precise);
          const approx = op(vague);
          expect(approx === 'X' || approx === exact, `${name}: ${precise} → ${vague}`).toBe(true);
        }
      }
    });
  }
});

describe('signal helpers', () => {
  it('isKnown и fromBoolean', () => {
    expect(isKnown(0)).toBe(true);
    expect(isKnown(1)).toBe(true);
    expect(isKnown('X')).toBe(false);
    expect(fromBoolean(true)).toBe(1);
    expect(fromBoolean(false)).toBe(0);
  });
});
