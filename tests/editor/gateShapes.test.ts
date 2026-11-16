import { describe, expect, it } from 'vitest';
import { BUILTIN_ELEMENTS } from '@/core/elements';
import { PIN_PITCH } from '@/editor/layout/geometry';
import {
  backEdgeX,
  backExtension,
  bubbleCenter,
  BUBBLE_RADIUS,
  GATE_SYMBOLS,
  gateBody,
  gateBodyPath,
  nodeKindOf,
  outputStartX,
  xorBackPath,
} from '@/editor/symbols/gateShapes';

const numbers = (path: string) => path.match(/-?\d+(\.\d+)?/g)!.map(Number);

describe('реестр символов', () => {
  it('все вентили первого этапа имеют ANSI-символ с правильной инверсией', () => {
    expect(Object.fromEntries(GATE_SYMBOLS)).toEqual({
      AND: { shape: 'and', inverted: false },
      NAND: { shape: 'and', inverted: true },
      OR: { shape: 'or', inverted: false },
      NOR: { shape: 'or', inverted: true },
      XOR: { shape: 'xor', inverted: false },
      XNOR: { shape: 'xor', inverted: true },
      NOT: { shape: 'buffer', inverted: true },
      BUFFER: { shape: 'buffer', inverted: false },
    });
  });

  it('вид узла: вентили, INPUT, OUTPUT, CONSTANT, MUX, функциональные блоки, остальное — прямоугольник', () => {
    const kinds = Object.fromEntries(BUILTIN_ELEMENTS.map((d) => [d.type, nodeKindOf(d.type)]));
    expect(kinds).toEqual({
      INPUT: 'input',
      OUTPUT: 'output',
      CLOCK: 'clock',
      CONSTANT: 'constant',
      AND: 'gate',
      OR: 'gate',
      NOT: 'gate',
      BUFFER: 'gate',
      NAND: 'gate',
      NOR: 'gate',
      XOR: 'gate',
      XNOR: 'gate',
      MUX: 'mux',
      DEMUX: 'mux',
      DECODER: 'block',
      ENCODER: 'block',
      PRIORITY_ENCODER: 'block',
      D_LATCH: 'box',
      D_FLIP_FLOP: 'box',
      T_FLIP_FLOP: 'box',
      JK_FLIP_FLOP: 'box',
    });
    expect(nodeKindOf('UNKNOWN_TYPE')).toBe('box');
    expect(nodeKindOf('toString')).toBe('box');
  });
});

describe('контуры', () => {
  const body = gateBody(60);

  it('корпус по центру узла и в пределах ограничений высоты', () => {
    expect(body.y * 2 + body.height).toBe(60);
    expect(gateBody(40).height).toBeGreaterThanOrEqual(30);
    expect(gateBody(180).height).toBeLessThanOrEqual(64);
  });

  /** Передняя точка формы: для AND — конец дуги (H + rx), для остальных — острие (наибольший X). */
  const frontX = (shape: string, path: string) => {
    if (shape === 'and') {
      const [, h, rx] = path.match(/H (\S+) A (\S+)/)!;
      return Number(h) + Number(rx);
    }
    const values = numbers(path);
    return Math.max(...values.filter((_, i) => i % 2 === 0));
  };

  it.each([...GATE_SYMBOLS])('%s — замкнутый путь, передняя точка у выхода или у кружка инверсии', (_, symbol) => {
    const path = gateBodyPath(symbol, body);
    expect(path).toMatch(/^M /);
    expect(path.trim().endsWith('Z')).toBe(true);
    expect(path).not.toMatch(/NaN|undefined/);
    const expected = symbol.inverted ? bubbleCenter(body).cx - BUBBLE_RADIUS : outputStartX(body);
    expect(frontX(symbol.shape, path)).toBeCloseTo(expected, 5);
  });

  it('кружок инверсии касается начала выходной линии', () => {
    expect(bubbleCenter(body).cx + BUBBLE_RADIUS).toBe(outputStartX(body));
  });

  it('XOR смещён вправо относительно дополнительной дуги', () => {
    const xorBody = numbers(gateBodyPath(GATE_SYMBOLS.get('XOR')!, body));
    expect(xorBody[0]).toBeGreaterThan(body.x);
    expect(numbers(xorBackPath(body))[0]).toBe(body.x);
  });
});

describe('входные линии', () => {
  const body = gateBody(80);

  it('у AND и NOT линия упирается в плоскую заднюю сторону', () => {
    expect(backEdgeX(GATE_SYMBOLS.get('AND')!, body, 40)).toBe(body.x);
    expect(backEdgeX(GATE_SYMBOLS.get('NOT')!, body, 40)).toBe(body.x);
  });

  it('у OR линия касается вогнутой стороны: глубже в середине, у краёв — у начала', () => {
    const or = GATE_SYMBOLS.get('OR')!;
    const middle = backEdgeX(or, body, body.y + body.height / 2);
    expect(middle).toBeGreaterThan(body.x);
    expect(backEdgeX(or, body, body.y)).toBe(body.x);
    expect(backEdgeX(or, body, PIN_PITCH)).toBeLessThan(middle);
  });

  it('пины за пределами корпуса продлевают заднюю сторону', () => {
    const tall = gateBody(9 * PIN_PITCH);
    const pins = Array.from({ length: 8 }, (_, i) => (i + 1) * PIN_PITCH);
    expect(backExtension(tall, pins)).toEqual({ y1: PIN_PITCH, y2: 8 * PIN_PITCH });
    expect(backExtension(gateBody(60), [20, 40])).toBeNull();
  });
});
