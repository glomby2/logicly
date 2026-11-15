import { describe, expect, it } from 'vitest';
import { AND, BUILTIN_ELEMENTS, createDefaultRegistry, defineUnaryGate, ElementRegistry } from '@/core/elements';

describe('ElementRegistry', () => {
  it('реестр по умолчанию содержит встроенные элементы в порядке палитры', () => {
    const registry = createDefaultRegistry();
    expect(registry.list().map((d) => d.type)).toEqual([
      'INPUT',
      'OUTPUT',
      'AND',
      'OR',
      'NOT',
      'BUFFER',
      'NAND',
      'NOR',
      'XOR',
      'XNOR',
      'MUX',
      'DEMUX',
    ]);
    expect(BUILTIN_ELEMENTS).toHaveLength(12);
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
    const REPEATER = defineUnaryGate({ type: 'TEST_REPEATER', description: 'Повторитель', operation: (s) => s });
    const registry = createDefaultRegistry();
    registry.register(REPEATER);
    expect(registry.require('TEST_REPEATER').evaluate({ inputs: [1], props: {}, state: undefined }).outputs).toEqual([1]);
  });

  it('экземпляры реестра независимы', () => {
    const a = createDefaultRegistry();
    const b = createDefaultRegistry();
    a.register(defineUnaryGate({ type: 'TEST_REPEATER', description: '', operation: (s) => s }));
    expect(b.has('TEST_REPEATER')).toBe(false);
  });
});
