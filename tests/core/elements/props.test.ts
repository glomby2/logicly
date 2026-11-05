import { describe, expect, it } from 'vitest';
import { AND, INPUT, NOT, resolveProps } from '@/core/elements';

describe('resolveProps', () => {
  it('подставляет значения по умолчанию', () => {
    expect(resolveProps(AND)).toEqual({ inputCount: 2 });
    expect(resolveProps(INPUT, {})).toEqual({ value: false });
    expect(resolveProps(NOT, {})).toEqual({});
  });

  it('сохраняет корректные значения', () => {
    expect(resolveProps(AND, { inputCount: 5 })).toEqual({ inputCount: 5 });
    expect(resolveProps(INPUT, { value: true })).toEqual({ value: true });
  });

  it('ограничивает целые числа диапазоном и округляет', () => {
    expect(resolveProps(AND, { inputCount: 1 })).toEqual({ inputCount: 2 });
    expect(resolveProps(AND, { inputCount: 100 })).toEqual({ inputCount: 8 });
    expect(resolveProps(AND, { inputCount: 3.6 })).toEqual({ inputCount: 4 });
    expect(resolveProps(AND, { inputCount: Number.NaN })).toEqual({ inputCount: 2 });
  });

  it('отбрасывает значения неверного типа и неизвестные ключи', () => {
    expect(resolveProps(AND, { inputCount: '3' })).toEqual({ inputCount: 2 });
    expect(resolveProps(INPUT, { value: 1, extra: 'x' })).toEqual({ value: false });
  });
});
