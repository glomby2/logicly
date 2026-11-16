import { describe, expect, it } from 'vitest';
import { createDefaultRegistry, DEMUX, MUX } from '@/core/elements';
import { toFlowNode } from '@/editor/adapters/flowMapping';
import { computeGeometry } from '@/editor/layout/geometry';
import { MUX_SYMBOLS, muxBodyPath, muxBottomEdgeY, muxInset, type MuxOrientation } from '@/editor/symbols/muxShapes';

const registry = createDefaultRegistry();
const numbers = (path: string) => path.match(/-?\d+(\.\d+)?/g)!.map(Number);
const geometryOf = (definition: typeof MUX, selectBits: number) => computeGeometry('mux', definition.pins({ selectBits }));

describe('символы MUX и DEMUX', () => {
  it('реестр: MUX сужается к выходу, DEMUX — к входу', () => {
    expect(Object.fromEntries(MUX_SYMBOLS)).toEqual({ MUX: 'narrow-right', DEMUX: 'narrow-left' });
  });

  it.each<[MuxOrientation, number[]]>([
    ['narrow-right', [0, 0, 80, 15, 80, 45, 0, 60]],
    ['narrow-left', [0, 15, 80, 0, 80, 60, 0, 45]],
  ])('%s: замкнутая трапеция по границам узла', (orientation, points) => {
    const path = muxBodyPath(orientation, 80, 60);
    expect(path.startsWith('M ') && path.endsWith(' Z')).toBe(true);
    expect(numbers(path)).toEqual(points);
  });

  it('наклон узкой стороны не больше шага сетки', () => {
    expect(muxInset(60)).toBe(15);
    expect(muxInset(100)).toBe(20);
    expect(muxInset(180)).toBe(20);
  });

  it('одиночный пин на узкой стороне попадает на корпус', () => {
    for (const [definition, side] of [
      [MUX, 'right'],
      [DEMUX, 'left'],
    ] as const) {
      for (const bits of [1, 2, 3]) {
        const geometry = geometryOf(definition, bits);
        const inset = muxInset(geometry.height);
        for (const pin of geometry.pins.filter((p) => p.side === side)) {
          expect(pin.y).toBeGreaterThan(inset);
          expect(pin.y).toBeLessThan(geometry.height - inset);
        }
      }
    }
  });

  it('линии входов выбора идут от нижнего края узла до наклонной стороны', () => {
    // MUX: нижняя сторона поднимается к узкому (правому) краю.
    expect(muxBottomEdgeY('narrow-right', 80, 60, 0)).toBe(60);
    expect(muxBottomEdgeY('narrow-right', 80, 60, 40)).toBe(52.5);
    expect(muxBottomEdgeY('narrow-right', 80, 60, 80)).toBe(45);
    expect(muxBottomEdgeY('narrow-left', 80, 60, 20)).toBe(48.75);
    for (const [definition, orientation] of [
      [MUX, 'narrow-right'],
      [DEMUX, 'narrow-left'],
    ] as const) {
      for (const bits of [1, 2, 3]) {
        const geometry = geometryOf(definition, bits);
        for (const pin of geometry.pins.filter((p) => p.side === 'bottom')) {
          const edge = muxBottomEdgeY(orientation, geometry.width, geometry.height, pin.x);
          expect(edge).toBeLessThan(pin.y);
          expect(edge).toBeGreaterThanOrEqual(geometry.height - muxInset(geometry.height));
        }
      }
    }
  });

  it('конфигурация на символе (variant узла): MUX 2:1, 4:1, 8:1; DEMUX 1:2, 1:4, 1:8', () => {
    const variantOf = (type: string, selectBits: number) =>
      toFlowNode({ id: 'm', type, position: { x: 0, y: 0 }, props: { selectBits } }, registry, false).data.variant;
    expect([1, 2, 3].map((bits) => variantOf('MUX', bits))).toEqual(['2:1', '4:1', '8:1']);
    expect([1, 2, 3].map((bits) => variantOf('DEMUX', bits))).toEqual(['1:2', '1:4', '1:8']);
  });
});
