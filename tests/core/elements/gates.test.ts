import { describe, expect, it } from 'vitest';
import { AND, MAX_GATE_INPUTS, MIN_GATE_INPUTS, NAND, NOR, NOT, OR, XNOR, XOR } from '@/core/elements';
import type { KnownSignal, Signal } from '@/core/logic/signal';
import type { ElementDefinition } from '@/core/types/element';
import { knownCombinations } from '../../helpers/combinations';

type BooleanFn = (inputs: boolean[]) => boolean;

const ones = (inputs: boolean[]) => inputs.filter(Boolean).length;

const reference: [ElementDefinition, BooleanFn][] = [
  [AND, (i) => i.every(Boolean)],
  [OR, (i) => i.some(Boolean)],
  [NAND, (i) => !i.every(Boolean)],
  [NOR, (i) => !i.some(Boolean)],
  [XOR, (i) => ones(i) % 2 === 1],
  [XNOR, (i) => ones(i) % 2 === 0],
];

function evaluate(definition: ElementDefinition, inputs: Signal[]): Signal {
  const props = { ...definition.defaultProps, inputCount: inputs.length };
  return definition.evaluate({ inputs, props, state: undefined }).outputs[0]!;
}

describe.each(reference)('$type', (definition, expected) => {
  it.each([2, 3, 4])('совпадает с таблицей истинности для %i входов', (count) => {
    for (const inputs of knownCombinations(count)) {
      const value: KnownSignal = expected(inputs.map((s) => s === 1)) ? 1 : 0;
      expect(evaluate(definition, inputs), inputs.join('')).toBe(value);
    }
  });

  it('число входов задаётся свойством inputCount', () => {
    for (let count = MIN_GATE_INPUTS; count <= MAX_GATE_INPUTS; count++) {
      const pins = definition.pins({ inputCount: count });
      expect(pins.inputs.map((p) => p.id)).toEqual(Array.from({ length: count }, (_, i) => `in${i}`));
      expect(pins.outputs.map((p) => p.id)).toEqual(['out0']);
    }
  });

  it('по умолчанию имеет 2 входа и редактируемое свойство inputCount', () => {
    expect(definition.defaultProps).toEqual({ inputCount: 2 });
    expect(definition.propSchema).toEqual([
      expect.objectContaining({ key: 'inputCount', kind: 'integer', min: 2, max: 8 }),
    ]);
    expect(definition.category).toBe('gates');
    expect(definition.label).toBe(definition.type);
  });
});

describe('X на входах вентилей', () => {
  it('доминирующее значение перекрывает X', () => {
    expect(evaluate(AND, [0, 'X'])).toBe(0);
    expect(evaluate(NAND, [0, 'X'])).toBe(1);
    expect(evaluate(OR, [1, 'X'])).toBe(1);
    expect(evaluate(NOR, [1, 'X'])).toBe(0);
  });

  it('без доминирующего значения результат X', () => {
    expect(evaluate(AND, [1, 'X'])).toBe('X');
    expect(evaluate(NAND, [1, 'X'])).toBe('X');
    expect(evaluate(OR, [0, 'X'])).toBe('X');
    expect(evaluate(NOR, [0, 'X'])).toBe('X');
    expect(evaluate(XOR, [0, 'X'])).toBe('X');
    expect(evaluate(XNOR, [1, 'X'])).toBe('X');
  });
});

describe('NOT', () => {
  const run = (input: Signal) => NOT.evaluate({ inputs: [input], props: {}, state: undefined }).outputs;

  it('инвертирует сигнал', () => {
    expect(run(0)).toEqual([1]);
    expect(run(1)).toEqual([0]);
    expect(run('X')).toEqual(['X']);
  });

  it('имеет один вход и один выход без свойств', () => {
    expect(NOT.pins({})).toEqual({ inputs: [{ id: 'in0' }], outputs: [{ id: 'out0' }] });
    expect(NOT.defaultProps).toEqual({});
    expect(NOT.propSchema).toBeUndefined();
  });
});
