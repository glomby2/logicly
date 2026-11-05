import { describe, expect, it } from 'vitest';
import { carryInteractiveProps, changedPropKeys, classifyChange, updateComponentProps } from '@/core/circuit';
import { createDefaultRegistry } from '@/core/elements';
import type { Circuit } from '@/core/types/circuit';
import { CircuitBuilder } from '../../helpers/circuitBuilder';

const registry = createDefaultRegistry();
const base = () =>
  new CircuitBuilder().input('A').gate('G', 'AND', 3).output('L').wire('A', 'G.in0').wire('G', 'L').build();

const mapComponent = (circuit: Circuit, id: string, fn: (c: Circuit['components'][number]) => object): Circuit => ({
  ...circuit,
  components: circuit.components.map((c) => (c.id === id ? { ...c, ...fn(c) } : c)),
});

describe('classifyChange', () => {
  it('та же схема — none', () => {
    const circuit = base();
    expect(classifyChange(circuit, circuit, registry)).toBe('none');
  });

  it('перемещение и подпись — none', () => {
    const circuit = base();
    expect(classifyChange(circuit, mapComponent(circuit, 'G', () => ({ position: { x: 5, y: 7 } })), registry)).toBe('none');
    expect(classifyChange(circuit, mapComponent(circuit, 'G', () => ({ label: 'Gate' })), registry)).toBe('none');
  });

  it('равные свойства в новом объекте — none', () => {
    const circuit = base();
    expect(classifyChange(circuit, mapComponent(circuit, 'G', (c) => ({ props: { ...c.props } })), registry)).toBe('none');
  });

  it('свойства без смены пинов — props', () => {
    const circuit = base();
    expect(classifyChange(circuit, mapComponent(circuit, 'A', () => ({ props: { value: true } })), registry)).toBe('props');
  });

  it('смена числа входов — structure', () => {
    const circuit = base();
    expect(classifyChange(circuit, updateComponentProps(circuit, registry, 'G', { inputCount: 4 }), registry)).toBe(
      'structure',
    );
  });

  it('провода, состав и порядок элементов — structure', () => {
    const circuit = base();
    const [w1, w2] = circuit.wires;
    expect(classifyChange(circuit, { ...circuit, wires: [w1!] }, registry)).toBe('structure');
    expect(
      classifyChange(circuit, { ...circuit, wires: [w1!, { ...w2!, to: { componentId: 'L', pinId: 'in0' }, id: 'other' }] }, registry),
    ).toBe('structure');
    expect(classifyChange(circuit, { ...circuit, components: circuit.components.slice(1) }, registry)).toBe('structure');
    expect(classifyChange(circuit, { ...circuit, components: [...circuit.components].reverse() }, registry)).toBe(
      'structure',
    );
  });

  it('новый массив проводов с теми же проводами — не structure', () => {
    const circuit = base();
    expect(classifyChange(circuit, { ...circuit, wires: circuit.wires.map((w) => ({ ...w })) }, registry)).toBe('none');
  });
});

describe('changedPropKeys', () => {
  it('находит различающиеся и отсутствующие ключи', () => {
    expect(changedPropKeys({ a: 1, b: true }, { a: 1, b: false, c: 'x' }).sort()).toEqual(['b', 'c']);
    expect(changedPropKeys({ a: 1 }, { a: 1 })).toEqual([]);
  });
});

describe('carryInteractiveProps', () => {
  it('переносит текущее положение переключателя в восстанавливаемую схему', () => {
    const snapshot = new CircuitBuilder().input('A').input('B').gate('G', 'AND').build();
    const current = new CircuitBuilder().input('A', true).input('B').build();
    const result = carryInteractiveProps(snapshot, current, registry);
    expect(result.components.map((c) => c.props)).toEqual([{ value: true }, { value: false }, {}]);
  });

  it('не трогает неинтерактивные свойства и элементы, которых нет в текущей схеме', () => {
    const snapshot = new CircuitBuilder().input('A').gate('G', 'AND', 3).build();
    const current = new CircuitBuilder().gate('G', 'AND', 5).build();
    expect(carryInteractiveProps(snapshot, current, registry)).toBe(snapshot);
  });
});
