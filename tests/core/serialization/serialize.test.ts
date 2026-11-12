import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { CURRENT_VERSION, FILE_FORMAT, serializeCircuit, toCircuitFile } from '@/core/serialization';
import type { Circuit } from '@/core/types/circuit';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import { normalized } from '../../helpers/files';

const registry = createDefaultRegistry();

describe('serializeCircuit', () => {
  it('пишет формат, версию, название, элементы и провода', () => {
    const circuit = normalized(new CircuitBuilder().input('A', true).gate('G', 'AND', 3).wire('A', 'G.in1').build(), registry);
    const file = JSON.parse(serializeCircuit(circuit, '  Схема  '));
    expect(file).toEqual({
      format: FILE_FORMAT,
      version: CURRENT_VERSION,
      name: 'Схема',
      components: [
        { id: 'A', type: 'INPUT', position: { x: 0, y: 0 }, props: { value: true } },
        { id: 'G', type: 'AND', position: { x: 0, y: 0 }, props: { inputCount: 3 } },
      ],
      wires: [{ id: 'w1', from: { componentId: 'A', pinId: 'out0' }, to: { componentId: 'G', pinId: 'in1' } }],
    });
    expect(Object.keys(file)).toEqual(['format', 'version', 'name', 'components', 'wires']);
  });

  it('JSON с отступом 2 и переводом строки в конце', () => {
    const text = serializeCircuit({ components: [], wires: [] }, 'x');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "format": "logic-sim",');
  });

  it('детерминирован: порядок ключей свойств не влияет на текст', () => {
    const make = (props: Record<string, number | boolean>): Circuit => ({
      components: [{ id: 'c', type: 'X', position: { x: 1, y: 2 }, props }],
      wires: [],
    });
    const a = serializeCircuit(make({ b: 1, a: true }), 'n');
    const b = serializeCircuit(make({ a: true, b: 1 }), 'n');
    expect(a).toBe(b);
    expect(a.indexOf('"a"')).toBeLessThan(a.indexOf('"b"'));
  });

  it('пустая подпись и служебные поля в файл не попадают', () => {
    const extra = {
      id: 'c',
      type: 'AND',
      position: { x: 1, y: 2, extra: 1 },
      label: '',
      props: { inputCount: 2 },
      selected: true,
      measured: { width: 10 },
    };
    const file = toCircuitFile({ components: [extra], wires: [] } as unknown as Circuit, 'n');
    expect(file.components[0]).toEqual({ id: 'c', type: 'AND', position: { x: 1, y: 2 }, props: { inputCount: 2 } });
  });

  it('подпись сохраняется', () => {
    const circuit: Circuit = {
      components: [{ id: 'c', type: 'INPUT', position: { x: 0, y: 0 }, label: 'X1', props: { value: false } }],
      wires: [],
    };
    expect(toCircuitFile(circuit, '').components[0]!.label).toBe('X1');
  });
});
