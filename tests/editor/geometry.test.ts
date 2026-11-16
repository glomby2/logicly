import { describe, expect, it } from 'vitest';
import {
  AND,
  CLOCK,
  CONSTANT,
  createDefaultRegistry,
  D_FLIP_FLOP,
  DECODER,
  D_LATCH,
  DEMUX,
  INPUT,
  JK_FLIP_FLOP,
  MUX,
  NOT,
  OUTPUT,
  T_FLIP_FLOP,
} from '@/core/elements';
import { BOX_TITLE_ROWS, computeGeometry, PIN_PITCH } from '@/editor/layout/geometry';
import { BLOCK_SYMBOLS, blockWidth } from '@/editor/symbols/blockShapes';

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

describe('computeGeometry: CLOCK и триггеры', () => {
  it('CLOCK — как INPUT: выход справа по центру', () => {
    const clock = computeGeometry('clock', CLOCK.pins(CLOCK.defaultProps));
    const input = computeGeometry('input', INPUT.pins(INPUT.defaultProps));
    expect(clock).toMatchObject({ kind: 'clock', width: input.width, height: input.height });
    expect(clock.pins).toEqual([{ id: 'out0', direction: 'output', side: 'right', x: clock.width, y: clock.height / 2 }]);
  });

  it.each([
    [D_FLIP_FLOP, ['d', 'clk'], 80],
    [T_FLIP_FLOP, ['t', 'clk'], 80],
    [JK_FLIP_FLOP, ['j', 'clk', 'k'], 100],
    [D_LATCH, ['d', 'e'], 80],
  ])('%#: под полосой названия входы слева на шаге сетки, Q и Q̄ справа; значок ▷ только у CLK', (definition, inputs, height) => {
    const geometry = computeGeometry('box', definition.pins({}));
    expect(geometry.height).toBe(height);
    const left = geometry.pins.filter((p) => p.side === 'left');
    expect(left.map((p) => [p.id, p.y])).toEqual(inputs.map((id, i) => [id, (i + 1 + BOX_TITLE_ROWS) * PIN_PITCH]));
    expect(left.filter((p) => p.clock).map((p) => p.id)).toEqual(inputs.filter((id) => id === 'clk'));
    expect(geometry.pins.filter((p) => p.side === 'right').map((p) => [p.id, p.label])).toEqual([
      ['q', 'Q'],
      ['qn', 'Q̄'],
    ]);
  });
});

describe('computeGeometry: функциональный блок и CONSTANT', () => {
  const blockOf = (type: string, codeBits: number) =>
    computeGeometry('block', registry.require(type).pins({ codeBits }), { width: blockWidth(type) });
  const ys = (geometry: ReturnType<typeof blockOf>, side: 'left' | 'right') =>
    geometry.pins.filter((p) => p.side === side).map((p) => [p.id, p.y]);
  const range = (prefix: string, count: number, firstY: number) =>
    Array.from({ length: count }, (_, i) => [`${prefix}${i}`, firstY + i * PIN_PITCH]);

  it.each([
    ['DECODER', 2, 100, 120, range('a', 2, 60), range('y', 4, 40)],
    ['DECODER', 3, 100, 200, range('a', 3, 80), range('y', 8, 40)],
    ['ENCODER', 2, 100, 120, range('d', 4, 40), range('a', 2, 60)],
    ['ENCODER', 3, 100, 200, range('d', 8, 40), range('a', 3, 80)],
    ['PRIORITY_ENCODER', 2, 140, 120, range('d', 4, 40), [...range('a', 2, 40), ['v', 80]]],
    ['PRIORITY_ENCODER', 3, 140, 200, range('d', 8, 40), [...range('a', 3, 80), ['v', 140]]],
  ])('%s, %i разряда: %i×%i; короткая сторона — посередине тела, на сетке', (type, bits, width, height, left, right) => {
    const geometry = blockOf(type, bits);
    expect(geometry).toMatchObject({ kind: 'block', width, height });
    expect(ys(geometry, 'left')).toEqual(left);
    expect(ys(geometry, 'right')).toEqual(right);
  });

  it('пины блоков: на сетке, под полосой названия, в границах узла; id — из определения', () => {
    for (const type of ['DECODER', 'ENCODER', 'PRIORITY_ENCODER']) {
      for (const bits of [2, 3]) {
        const pins = registry.require(type).pins({ codeBits: bits });
        const geometry = blockOf(type, bits);
        expect(geometry.pins.map((p) => p.id)).toEqual([...pins.inputs, ...pins.outputs].map((p) => p.id));
        for (const pin of geometry.pins) {
          expect(pin.y % PIN_PITCH).toBe(0);
          expect(pin.y).toBeGreaterThanOrEqual((BOX_TITLE_ROWS + 1) * PIN_PITCH);
          expect(pin.y).toBeLessThan(geometry.height);
          expect(pin.x === 0 || pin.x === geometry.width).toBe(true);
        }
      }
    }
  });

  it('ширина блока по умолчанию — как у прямоугольника; ширины из реестра символов', () => {
    expect(computeGeometry('block', DECODER.pins({ codeBits: 2 })).width).toBe(100);
    expect(Object.fromEntries([...BLOCK_SYMBOLS].map(([type, s]) => [type, s.width]))).toEqual({
      DECODER: 100,
      ENCODER: 100,
      PRIORITY_ENCODER: 140,
    });
    expect(blockWidth('AND')).toBeUndefined();
  });

  it('CONSTANT: 40×40, выход справа по центру', () => {
    expect(computeGeometry('constant', CONSTANT.pins(CONSTANT.defaultProps))).toEqual({
      kind: 'constant',
      width: 40,
      height: 40,
      pins: [{ id: 'out0', direction: 'output', side: 'right', x: 40, y: 20 }],
    });
  });
});

describe('computeGeometry: универсальный прямоугольник', () => {
  it('триггеры и защёлка — прежняя ширина 100 и правые пины Q, Q̄ под полосой названия', () => {
    for (const definition of [D_FLIP_FLOP, T_FLIP_FLOP, JK_FLIP_FLOP, D_LATCH]) {
      const geometry = computeGeometry('box', definition.pins({}));
      expect(geometry).toMatchObject({ kind: 'box', width: 100 });
      expect(geometry.pins.filter((p) => p.side === 'right').map((p) => p.y)).toEqual([40, 60]);
    }
  });

  it('учитывает стороны и подписи пинов; боковые пины — под полосой названия', () => {
    const geometry = computeGeometry('box', {
      inputs: [
        { id: 'd0', label: 'D0' },
        { id: 'd1', label: 'D1' },
        { id: 's0', label: 'S', side: 'bottom' },
      ],
      outputs: [{ id: 'y', label: 'Y' }],
    });
    const byId = Object.fromEntries(geometry.pins.map((p) => [p.id, p]));
    expect(BOX_TITLE_ROWS).toBe(1);
    expect(byId.d0).toMatchObject({ side: 'left', x: 0, y: 2 * PIN_PITCH, label: 'D0' });
    expect(byId.d1).toMatchObject({ side: 'left', x: 0, y: 3 * PIN_PITCH });
    expect(byId.s0).toMatchObject({ side: 'bottom', x: PIN_PITCH, y: geometry.height });
    expect(byId.y).toMatchObject({ side: 'right', x: geometry.width, y: 2 * PIN_PITCH });
    expect(geometry.height).toBe(4 * PIN_PITCH);
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
