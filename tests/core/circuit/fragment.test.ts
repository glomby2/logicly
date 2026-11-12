import { describe, expect, it } from 'vitest';
import { extractFragment, insertFragment, instantiateFragment, nextLabel } from '@/core/circuit';
import { createDefaultRegistry } from '@/core/elements';
import { EMPTY_CIRCUIT } from '@/core/types/circuit';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import { sequentialIds } from '../../helpers/stores';

const registry = createDefaultRegistry();
const circuit = () =>
  new CircuitBuilder().input('A').gate('N', 'NOT').output('L').wire('A', 'N').wire('N', 'L').build();

describe('extractFragment', () => {
  it('берёт выбранные элементы и только провода между ними', () => {
    const fragment = extractFragment(circuit(), ['A', 'N']);
    expect(fragment.components.map((c) => c.id)).toEqual(['A', 'N']);
    expect(fragment.wires.map((w) => w.id)).toEqual(['w1']);
  });
});

describe('instantiateFragment', () => {
  it('выдаёт новые id, сдвигает позиции и переподключает провода', () => {
    const fragment = extractFragment(circuit(), ['A', 'N']);
    const copy = instantiateFragment(fragment, sequentialIds(), { x: 20, y: 30 });
    expect(copy.components.map((c) => [c.id, c.position])).toEqual([
      ['input-1', { x: 20, y: 30 }],
      ['not-2', { x: 20, y: 30 }],
    ]);
    expect(copy.wires).toEqual([
      { id: 'w-3', from: { componentId: 'input-1', pinId: 'out0' }, to: { componentId: 'not-2', pinId: 'in0' } },
    ]);
  });
});

describe('insertFragment', () => {
  it('добавляет элементы и провода с проверкой', () => {
    const copy = instantiateFragment(extractFragment(circuit(), ['A', 'N']), sequentialIds(), { x: 0, y: 0 });
    const result = insertFragment(EMPTY_CIRCUIT, registry, copy);
    expect(result.components).toHaveLength(2);
    expect(result.wires).toHaveLength(1);
  });

  it('отбрасывает недопустимые провода', () => {
    const result = insertFragment(EMPTY_CIRCUIT, registry, {
      components: [{ id: 'a', type: 'INPUT', position: { x: 0, y: 0 }, props: {} }],
      wires: [{ id: 'w', from: { componentId: 'a', pinId: 'out0' }, to: { componentId: 'missing', pinId: 'in0' } }],
    });
    expect(result.wires).toEqual([]);
  });
});

describe('nextLabel', () => {
  it('выдаёт следующий свободный номер', () => {
    const labeled = new CircuitBuilder().input('a').input('b').input('c').build();
    const withLabels = {
      ...labeled,
      components: labeled.components.map((c, i) => ({ ...c, label: ['X1', 'X7', 'Y2'][i] })),
    };
    expect(nextLabel(withLabels, 'X')).toBe('X8');
    expect(nextLabel(withLabels, 'Y')).toBe('Y3');
    expect(nextLabel(EMPTY_CIRCUIT, 'X')).toBe('X1');
  });

  it('экранирует спецсимволы префикса', () => {
    const c = { ...EMPTY_CIRCUIT, components: [{ id: 'a', type: 'INPUT', position: { x: 0, y: 0 }, props: {}, label: 'aa1' }] };
    expect(nextLabel(c, 'a.')).toBe('a.1');
  });
});
