import { describe, expect, it } from 'vitest';
import { AND, DEMUX, MUX, NOT, createDefaultRegistry, INPUT, OUTPUT } from '@/core/elements';
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

describe('computeGeometry: MUX и DEMUX', () => {
  const geometryOf = (definition: typeof MUX, selectBits: number) => computeGeometry('mux', definition.pins({ selectBits }));
  const byId = (geometry: ReturnType<typeof geometryOf>) => Object.fromEntries(geometry.pins.map((p) => [p.id, p]));

  it.each([
    [1, 60],
    [2, 100],
    [3, 180],
  ])('MUX, %i входа выбора: данные слева на шаге сетки, Y по центру справа, S снизу', (bits, height) => {
    const geometry = geometryOf(MUX, bits);
    const pins = byId(geometry);
    const count = 2 ** bits;
    expect(geometry).toMatchObject({ kind: 'mux', width: 80, height });
    for (let i = 0; i < count; i++) {
      expect(pins[`d${i}`]).toMatchObject({ direction: 'input', side: 'left', x: 0, y: (i + 1) * PIN_PITCH, label: `D${i}` });
    }
    expect(pins.y).toMatchObject({ direction: 'output', side: 'right', x: geometry.width, y: height / 2, label: 'Y' });
    const select = Array.from({ length: bits }, (_, i) => pins[`s${i}`]!);
    expect(select.every((p) => p.side === 'bottom' && p.y === height && p.direction === 'input')).toBe(true);
    // Входы выбора по центру нижней стороны с шагом сетки, s0 — левее.
    const xs = select.map((p) => p.x);
    expect(xs.map((x, i) => (i === 0 ? 0 : x - xs[i - 1]!))).toEqual([0, ...Array(bits - 1).fill(PIN_PITCH)]);
    expect((xs[0]! + xs.at(-1)!) / 2).toBe(geometry.width / 2);
  });

  it.each([1, 2, 3])('DEMUX, %i входа выбора: D по центру слева, выходы справа на шаге сетки', (bits) => {
    const geometry = geometryOf(DEMUX, bits);
    const pins = byId(geometry);
    expect(geometry.height).toBe((2 ** bits + 1) * PIN_PITCH);
    expect(pins.d).toMatchObject({ direction: 'input', side: 'left', x: 0, y: geometry.height / 2 });
    for (let i = 0; i < 2 ** bits; i++) {
      expect(pins[`y${i}`]).toMatchObject({ direction: 'output', side: 'right', x: geometry.width, y: (i + 1) * PIN_PITCH });
    }
    expect(Array.from({ length: bits }, (_, i) => pins[`s${i}`]!.side)).toEqual(Array(bits).fill('bottom'));
  });

  it('пины не выходят за границы узла', () => {
    for (const definition of [MUX, DEMUX]) {
      for (const bits of [1, 2, 3]) {
        const geometry = geometryOf(definition, bits);
        for (const pin of geometry.pins) {
          expect(pin.x).toBeGreaterThanOrEqual(0);
          expect(pin.x).toBeLessThanOrEqual(geometry.width);
          expect(pin.y).toBeGreaterThanOrEqual(0);
          expect(pin.y).toBeLessThanOrEqual(geometry.height);
        }
      }
    }
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
