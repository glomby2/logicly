import { describe, expect, it } from 'vitest';
import { AND, NOT, createDefaultRegistry, INPUT, OUTPUT } from '@/core/elements';
import { computeGeometry, PIN_PITCH } from '@/editor/layout/geometry';

const registry = createDefaultRegistry();
const gatePins = (inputCount: number) => AND.pins({ inputCount });

describe('computeGeometry: вентили', () => {
  it.each([2, 3, 5, 8])('%i входов — пины на шаге сетки, выход по центру', (count) => {
    const geometry = computeGeometry('gate', gatePins(count));
    const inputs = geometry.pins.filter((p) => p.direction === 'input');
    expect(inputs.map((p) => p.y)).toEqual(Array.from({ length: count }, (_, i) => (i + 1) * PIN_PITCH));
    expect(inputs.every((p) => p.x === 0 && p.side === 'left')).toBe(true);
    expect(geometry.height).toBe((count + 1) * PIN_PITCH);

    const output = geometry.pins.find((p) => p.direction === 'output')!;
    expect(output).toMatchObject({ id: 'out0', side: 'right', x: geometry.width, y: geometry.height / 2 });
  });

  it('NOT: вход и выход на одной линии', () => {
    const geometry = computeGeometry('gate', NOT.pins({}));
    expect(geometry.pins.map((p) => p.y)).toEqual([PIN_PITCH, PIN_PITCH]);
  });
});

describe('computeGeometry: INPUT и OUTPUT', () => {
  it('INPUT — выход справа по центру, OUTPUT — вход слева по центру', () => {
    const input = computeGeometry('input', INPUT.pins(INPUT.defaultProps));
    expect(input.pins).toEqual([{ id: 'out0', direction: 'output', side: 'right', x: input.width, y: input.height / 2 }]);
    const output = computeGeometry('output', OUTPUT.pins({}));
    expect(output.pins).toEqual([{ id: 'in0', direction: 'input', side: 'left', x: 0, y: output.height / 2 }]);
  });
});

describe('computeGeometry: универсальный прямоугольник', () => {
  it('учитывает стороны и подписи пинов (на примере MUX-подобного элемента)', () => {
    const geometry = computeGeometry('box', {
      inputs: [
        { id: 'd0', label: 'D0' },
        { id: 'd1', label: 'D1' },
        { id: 's0', label: 'S', side: 'bottom' },
      ],
      outputs: [{ id: 'y', label: 'Y' }],
    });
    const byId = Object.fromEntries(geometry.pins.map((p) => [p.id, p]));
    expect(byId.d0).toMatchObject({ side: 'left', x: 0, y: PIN_PITCH, label: 'D0' });
    expect(byId.d1).toMatchObject({ side: 'left', x: 0, y: 2 * PIN_PITCH });
    expect(byId.s0).toMatchObject({ side: 'bottom', x: PIN_PITCH, y: geometry.height });
    expect(byId.y).toMatchObject({ side: 'right', x: geometry.width, y: PIN_PITCH });
  });

  it('элемент без пинов имеет минимальный размер', () => {
    const geometry = computeGeometry('box', { inputs: [], outputs: [] });
    expect(geometry.pins).toEqual([]);
    expect(geometry.width).toBeGreaterThan(0);
    expect(geometry.height).toBe(3 * PIN_PITCH);
  });

  it('id пинов совпадают с определением элемента', () => {
    for (const definition of registry.list()) {
      const pins = definition.pins(definition.defaultProps);
      const geometry = computeGeometry('box', pins);
      expect(geometry.pins.map((p) => p.id).sort()).toEqual([...pins.inputs, ...pins.outputs].map((p) => p.id).sort());
    }
  });
});
