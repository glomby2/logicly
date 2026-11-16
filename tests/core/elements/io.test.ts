import { describe, expect, it } from 'vitest';
import { BUILTIN_ELEMENTS, CONSTANT, INPUT, OUTPUT, resolveProps, switchProp } from '@/core/elements';

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

describe('CONSTANT', () => {
  const run = (level: boolean) => CONSTANT.evaluate({ inputs: [], props: { level }, state: undefined }).outputs;

  it('по умолчанию 1: без входов, один выход out0 (как у INPUT), категория «Ввод и вывод»', () => {
    expect(CONSTANT.defaultProps).toEqual({ level: true });
    expect(CONSTANT.pins(CONSTANT.defaultProps)).toEqual({ inputs: [], outputs: [{ id: 'out0' }] });
    expect(CONSTANT.category).toBe('io');
    expect(CONSTANT.propSchema).toEqual([{ key: 'level', label: 'Логическая 1', kind: 'boolean' }]);
  });

  it('выдаёт уровень из свойства level; конфигурация — «0» или «1»', () => {
    expect(run(true)).toEqual([1]);
    expect(run(false)).toEqual([0]);
    expect(CONSTANT.variant!({ level: true })).toBe('1');
    expect(CONSTANT.variant!({ level: false })).toBe('0');
  });

  it('не внешний вход: нет роли port, автоподписи, состояния и интерактивных свойств — не переключается', () => {
    expect(CONSTANT.port).toBeUndefined();
    expect(CONSTANT.labelPrefix).toBeUndefined();
    expect(CONSTANT.initialState).toBeUndefined();
    expect(CONSTANT.interactiveProps).toBeUndefined();
    expect(switchProp(CONSTANT)).toBeUndefined();
    expect(switchProp(INPUT)).toBe('value');
    expect(switchProp(undefined)).toBeUndefined();
  });

  it('неверный уровень нормализуется при разборе свойств', () => {
    expect(resolveProps(CONSTANT, { level: 'yes' } as never)).toEqual({ level: true });
    expect(resolveProps(CONSTANT, { level: false, value: true })).toEqual({ level: false });
  });
});

describe('OUTPUT', () => {
  it('имеет один вход и не имеет выходов', () => {
    expect(OUTPUT.pins({})).toEqual({ inputs: [{ id: 'in0' }], outputs: [] });
    expect(OUTPUT.evaluate({ inputs: [1], props: {}, state: undefined }).outputs).toEqual([]);
    expect(OUTPUT.category).toBe('io');
  });
});

describe('роли внешних выводов', () => {
  it('INPUT — вход по свойству value, OUTPUT — выход', () => {
    expect(INPUT.port).toEqual({ kind: 'input', prop: 'value' });
    expect(OUTPUT.port).toEqual({ kind: 'output' });
  });

  it('у вентилей роли нет', () => {
    for (const definition of BUILTIN_ELEMENTS.filter((d) => d.category === 'gates')) expect(definition.port).toBeUndefined();
  });
});
