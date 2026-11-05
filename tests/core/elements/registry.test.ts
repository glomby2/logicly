import { describe, expect, it } from 'vitest';
import { AND, BUILTIN_ELEMENTS, createDefaultRegistry, defineUnaryGate, ElementRegistry } from '@/core/elements';

describe('ElementRegistry', () => {
  it('реестр по умолчанию содержит 9 элементов первого этапа в порядке палитры', () => {
    const registry = createDefaultRegistry();
    expect(registry.list().map((d) => d.type)).toEqual([
      'INPUT',
      'OUTPUT',
      'AND',
      'OR',
      'NOT',
      'NAND',
      'NOR',
      'XOR',
      'XNOR',
    ]);
    expect(BUILTIN_ELEMENTS).toHaveLength(9);
  });

  it('get / has / require', () => {
    const registry = createDefaultRegistry();
    expect(registry.has('AND')).toBe(true);
    expect(registry.get('AND')).toBe(AND);
    expect(registry.require('AND')).toBe(AND);
    expect(registry.has('UNKNOWN')).toBe(false);
    expect(registry.get('UNKNOWN')).toBeUndefined();
    expect(() => registry.require('UNKNOWN')).toThrow(/Неизвестный тип элемента "UNKNOWN"/);
  });

  it('запрещает повторную регистрацию типа', () => {
    const registry = new ElementRegistry([AND]);
    expect(() => registry.register(AND)).toThrow(/уже зарегистрирован/);
  });

  it('позволяет зарегистрировать новый элемент без изменения ядра', () => {
    const BUFFER = defineUnaryGate({ type: 'BUFFER', description: 'Повторитель', operation: (s) => s });
    const registry = createDefaultRegistry();
    registry.register(BUFFER);
    expect(registry.require('BUFFER').evaluate({ inputs: [1], props: {}, state: undefined }).outputs).toEqual([1]);
  });

  it('экземпляры реестра независимы', () => {
    const a = createDefaultRegistry();
    const b = createDefaultRegistry();
    a.register(defineUnaryGate({ type: 'BUFFER', description: '', operation: (s) => s }));
    expect(b.has('BUFFER')).toBe(false);
  });
});
