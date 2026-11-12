import { describe, expect, it } from 'vitest';
import { connect, findWireToInput, isPinConnected, reconnect, resolveConnection } from '@/core/circuit';
import { createDefaultRegistry } from '@/core/elements';
import { CircuitBuilder } from '../../helpers/circuitBuilder';

const registry = createDefaultRegistry();
const ref = (componentId: string, pinId: string) => ({ componentId, pinId });

const base = () => new CircuitBuilder().input('A').input('B').gate('G', 'AND').gate('N', 'NOT').output('L').build();

describe('resolveConnection', () => {
  it('выход → вход принимается как есть', () => {
    expect(resolveConnection(base(), registry, ref('A', 'out0'), ref('G', 'in0'))).toEqual({
      ok: true,
      from: ref('A', 'out0'),
      to: ref('G', 'in0'),
    });
  });

  it('вход → выход нормализуется в выход → вход', () => {
    expect(resolveConnection(base(), registry, ref('G', 'in1'), ref('B', 'out0'))).toEqual({
      ok: true,
      from: ref('B', 'out0'),
      to: ref('G', 'in1'),
    });
  });

  it('запрещает выход → выход и вход → вход', () => {
    const circuit = base();
    expect(resolveConnection(circuit, registry, ref('A', 'out0'), ref('B', 'out0'))).toEqual({
      ok: false,
      reason: 'same-direction',
    });
    expect(resolveConnection(circuit, registry, ref('G', 'in0'), ref('L', 'in0'))).toEqual({
      ok: false,
      reason: 'same-direction',
    });
  });

  it('отклоняет несуществующие элементы и пины', () => {
    const circuit = base();
    expect(resolveConnection(circuit, registry, ref('Z', 'out0'), ref('G', 'in0'))).toMatchObject({
      reason: 'unknown-pin',
    });
    expect(resolveConnection(circuit, registry, ref('A', 'out0'), ref('G', 'in5'))).toMatchObject({
      reason: 'unknown-pin',
    });
  });

  it('отклоняет дубликат провода', () => {
    const circuit = new CircuitBuilder().input('A').gate('G', 'AND').wire('A', 'G.in0').build();
    expect(resolveConnection(circuit, registry, ref('G', 'in0'), ref('A', 'out0'))).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });

  it('сообщает, какой провод будет заменён на занятом входе', () => {
    const circuit = new CircuitBuilder().input('A').input('B').gate('G', 'AND').wire('A', 'G.in0').build();
    expect(resolveConnection(circuit, registry, ref('B', 'out0'), ref('G', 'in0'))).toMatchObject({
      ok: true,
      replaces: 'w1',
    });
  });

  it('разрешает обратную связь: выход элемента на его же вход', () => {
    expect(resolveConnection(base(), registry, ref('N', 'out0'), ref('N', 'in0'))).toMatchObject({ ok: true });
  });
});

describe('connect', () => {
  it('добавляет провод', () => {
    const { circuit, check } = connect(base(), registry, ref('A', 'out0'), ref('G', 'in0'), 'w1');
    expect(check.ok).toBe(true);
    expect(circuit.wires).toEqual([{ id: 'w1', from: ref('A', 'out0'), to: ref('G', 'in0') }]);
  });

  it('у входа остаётся один источник: новый провод заменяет старый', () => {
    let circuit = base();
    circuit = connect(circuit, registry, ref('A', 'out0'), ref('G', 'in0'), 'w1').circuit;
    circuit = connect(circuit, registry, ref('B', 'out0'), ref('G', 'in0'), 'w2').circuit;
    expect(circuit.wires).toEqual([{ id: 'w2', from: ref('B', 'out0'), to: ref('G', 'in0') }]);
  });

  it('один выход может питать несколько входов', () => {
    let circuit = base();
    circuit = connect(circuit, registry, ref('A', 'out0'), ref('G', 'in0'), 'w1').circuit;
    circuit = connect(circuit, registry, ref('A', 'out0'), ref('G', 'in1'), 'w2').circuit;
    circuit = connect(circuit, registry, ref('A', 'out0'), ref('L', 'in0'), 'w3').circuit;
    expect(circuit.wires.map((w) => w.to.componentId + ':' + w.to.pinId)).toEqual(['G:in0', 'G:in1', 'L:in0']);
  });

  it('при ошибке возвращает исходную схему без изменений', () => {
    const original = base();
    const { circuit, check } = connect(original, registry, ref('A', 'out0'), ref('B', 'out0'), 'w1');
    expect(check.ok).toBe(false);
    expect(circuit).toBe(original);
  });

  it('запрещает повторное использование id провода', () => {
    const circuit = connect(base(), registry, ref('A', 'out0'), ref('G', 'in0'), 'w1').circuit;
    expect(() => connect(circuit, registry, ref('B', 'out0'), ref('G', 'in1'), 'w1')).toThrow(/уже существует/);
  });
});

describe('reconnect', () => {
  const wired = () =>
    new CircuitBuilder().input('A').input('B').gate('G', 'AND').wire('A', 'G.in0').build();

  it('переносит конец провода на другой пин, сохраняя id', () => {
    const { circuit, check } = reconnect(wired(), registry, 'w1', ref('B', 'out0'), ref('G', 'in0'));
    expect(check.ok).toBe(true);
    expect(circuit.wires).toEqual([{ id: 'w1', from: ref('B', 'out0'), to: ref('G', 'in0') }]);
  });

  it('нормализует направление', () => {
    const { circuit } = reconnect(wired(), registry, 'w1', ref('G', 'in1'), ref('A', 'out0'));
    expect(circuit.wires).toEqual([{ id: 'w1', from: ref('A', 'out0'), to: ref('G', 'in1') }]);
  });

  it('недопустимое соединение и прежние концы не меняют схему', () => {
    const original = wired();
    expect(reconnect(original, registry, 'w1', ref('A', 'out0'), ref('B', 'out0')).circuit).toBe(original);
    const same = reconnect(original, registry, 'w1', ref('G', 'in0'), ref('A', 'out0'));
    expect(same.check.ok).toBe(true);
    expect(same.circuit).toBe(original);
    expect(reconnect(original, registry, 'missing', ref('A', 'out0'), ref('G', 'in1')).check.ok).toBe(false);
  });
});

describe('isPinConnected / findWireToInput', () => {
  it('определяет подключённые и свободные пины', () => {
    const circuit = new CircuitBuilder().input('A').gate('G', 'AND').wire('A', 'G.in0').build();
    expect(isPinConnected(circuit, ref('A', 'out0'))).toBe(true);
    expect(isPinConnected(circuit, ref('G', 'in0'))).toBe(true);
    expect(isPinConnected(circuit, ref('G', 'in1'))).toBe(false);
    expect(isPinConnected(circuit, ref('G', 'out0'))).toBe(false);
    expect(findWireToInput(circuit, ref('G', 'in0'))?.id).toBe('w1');
    expect(findWireToInput(circuit, ref('G', 'in1'))).toBeUndefined();
  });
});
