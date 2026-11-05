import { describe, expect, it } from 'vitest';
import {
  addComponent,
  pruneInvalidWires,
  removeComponents,
  removeWires,
  updateComponentProps,
} from '@/core/circuit';
import { createDefaultRegistry } from '@/core/elements';
import { EMPTY_CIRCUIT } from '@/core/types/circuit';
import { CircuitBuilder } from '../../helpers/circuitBuilder';

const registry = createDefaultRegistry();

describe('addComponent', () => {
  it('добавляет элемент с приведёнными свойствами', () => {
    const circuit = addComponent(EMPTY_CIRCUIT, registry, {
      id: 'G',
      type: 'AND',
      position: { x: 10, y: 20 },
      props: { inputCount: 99 },
    });
    expect(circuit.components).toEqual([{ id: 'G', type: 'AND', position: { x: 10, y: 20 }, props: { inputCount: 8 } }]);
  });

  it('запрещает повторяющиеся id и неизвестные типы', () => {
    const circuit = new CircuitBuilder().gate('G', 'AND').build();
    const component = { id: 'G', type: 'OR', position: { x: 0, y: 0 }, props: {} };
    expect(() => addComponent(circuit, registry, component)).toThrow(/уже существует/);
    expect(() => addComponent(EMPTY_CIRCUIT, registry, { ...component, type: 'NOPE' })).toThrow(/Неизвестный тип/);
  });
});

describe('удаление', () => {
  const circuit = new CircuitBuilder()
    .input('A')
    .input('B')
    .gate('G', 'AND')
    .output('L')
    .wire('A', 'G.in0')
    .wire('B', 'G.in1')
    .wire('G', 'L')
    .build();

  it('removeComponents удаляет элементы вместе с их проводами', () => {
    const result = removeComponents(circuit, ['G']);
    expect(result.components.map((c) => c.id)).toEqual(['A', 'B', 'L']);
    expect(result.wires).toEqual([]);
  });

  it('removeComponents не трогает несвязанные провода', () => {
    const result = removeComponents(circuit, ['A']);
    expect(result.wires.map((w) => w.id)).toEqual(['w2', 'w3']);
  });

  it('removeWires удаляет только указанные провода', () => {
    expect(removeWires(circuit, ['w1', 'w3']).wires.map((w) => w.id)).toEqual(['w2']);
  });
});

describe('updateComponentProps', () => {
  const wired = new CircuitBuilder()
    .input('A')
    .gate('G', 'AND', 4)
    .wire('A', 'G.in0')
    .wire('A', 'G.in1')
    .wire('A', 'G.in2')
    .wire('A', 'G.in3')
    .build();

  it('при уменьшении числа входов удаляет провода с исчезнувших пинов', () => {
    const result = updateComponentProps(wired, registry, 'G', { inputCount: 2 });
    expect(result.components.find((c) => c.id === 'G')?.props).toEqual({ inputCount: 2 });
    expect(result.wires.map((w) => w.to.pinId)).toEqual(['in0', 'in1']);
  });

  it('при увеличении числа входов сохраняет все провода', () => {
    const result = updateComponentProps(wired, registry, 'G', { inputCount: 6 });
    expect(result.wires).toHaveLength(4);
  });

  it('ограничивает значения диапазоном', () => {
    const result = updateComponentProps(wired, registry, 'G', { inputCount: 0 });
    expect(result.components.find((c) => c.id === 'G')?.props).toEqual({ inputCount: 2 });
  });
});

describe('pruneInvalidWires', () => {
  it('удаляет провода на несуществующие пины, неверного направления и лишние источники входа', () => {
    const circuit = new CircuitBuilder()
      .input('A')
      .input('B')
      .gate('G', 'AND')
      .wire('A', 'G.in0') // корректный
      .wire('B', 'G.in0') // второй источник того же входа
      .wire('A', 'G.in7') // нет такого пина
      .wire('G.in1', 'A.out0') // вход → выход
      .wire('Z', 'G.in1') // нет такого элемента
      .build();
    expect(pruneInvalidWires(circuit, registry).wires.map((w) => w.id)).toEqual(['w1']);
  });

  it('возвращает ту же схему, если удалять нечего', () => {
    const circuit = new CircuitBuilder().input('A').gate('G', 'AND').wire('A', 'G.in0').build();
    expect(pruneInvalidWires(circuit, registry)).toBe(circuit);
  });
});
