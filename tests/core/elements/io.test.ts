import { describe, expect, it } from 'vitest';
import { INPUT, OUTPUT } from '@/core/elements';

describe('INPUT', () => {
  it('выдаёт значение свойства value', () => {
    expect(INPUT.evaluate({ inputs: [], props: { value: false }, state: undefined }).outputs).toEqual([0]);
    expect(INPUT.evaluate({ inputs: [], props: { value: true }, state: undefined }).outputs).toEqual([1]);
  });

  it('по умолчанию выключен, без входов и с одним выходом', () => {
    expect(INPUT.defaultProps).toEqual({ value: false });
    expect(INPUT.pins(INPUT.defaultProps)).toEqual({ inputs: [], outputs: [{ id: 'out0' }] });
    expect(INPUT.category).toBe('io');
  });
});

describe('OUTPUT', () => {
  it('имеет один вход и не имеет выходов', () => {
    expect(OUTPUT.pins({})).toEqual({ inputs: [{ id: 'in0' }], outputs: [] });
    expect(OUTPUT.evaluate({ inputs: [1], props: {}, state: undefined }).outputs).toEqual([]);
    expect(OUTPUT.category).toBe('io');
  });
});
