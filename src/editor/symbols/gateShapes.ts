import { PIN_PITCH, type NodeKind } from '../layout/geometry';
import { MUX_SYMBOLS } from './muxShapes';

/*
 * ANSI-символы вентилей (IEEE Std 91): форма корпуса и признак инверсии (кружок на выходе).
 * Реестр по типу элемента; тип без записи рисуется универсальным прямоугольником.
 */

export type GateShape = 'and' | 'or' | 'xor' | 'buffer';

export interface GateSymbol {
  readonly shape: GateShape;
  readonly inverted: boolean;
}

export const GATE_SYMBOLS: ReadonlyMap<string, GateSymbol> = new Map([
  ['AND', { shape: 'and', inverted: false }],
  ['NAND', { shape: 'and', inverted: true }],
  ['OR', { shape: 'or', inverted: false }],
  ['NOR', { shape: 'or', inverted: true }],
  ['XOR', { shape: 'xor', inverted: false }],
  ['XNOR', { shape: 'xor', inverted: true }],
  ['NOT', { shape: 'buffer', inverted: true }],
  ['BUFFER', { shape: 'buffer', inverted: false }],
]);

const IO_KINDS: ReadonlyMap<string, NodeKind> = new Map([
  ['INPUT', 'input'],
  ['OUTPUT', 'output'],
  ['CLOCK', 'clock'],
]);

export function nodeKindOf(type: string): NodeKind {
  if (IO_KINDS.has(type)) return IO_KINDS.get(type)!;
  if (GATE_SYMBOLS.has(type)) return 'gate';
  return MUX_SYMBOLS.has(type) ? 'mux' : 'box';
}

export interface BodyBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const BUBBLE_RADIUS = 4;
/** Зазор между дополнительной дугой XOR и корпусом. */
export const XOR_GAP = 6;

const BODY_X = 16;
const BODY_WIDTH = 48;
const MIN_BODY_HEIGHT = 30;
const MAX_BODY_HEIGHT = 64;

const n = (value: number) => Number(value.toFixed(2));

/** Корпус по центру узла; при многих входах высота ограничена, а задняя сторона продлевается линией. */
export function gateBody(nodeHeight: number): BodyBox {
  const height = Math.min(MAX_BODY_HEIGHT, Math.max(MIN_BODY_HEIGHT, nodeHeight - PIN_PITCH));
  return { x: BODY_X, y: (nodeHeight - height) / 2, width: BODY_WIDTH, height };
}

/** Прямоугольник, в который вписывается сама форма (без кружка инверсии и дуги XOR). */
function shapeBox(symbol: GateSymbol, box: BodyBox): BodyBox {
  const left = symbol.shape === 'xor' ? XOR_GAP : 0;
  const right = symbol.inverted ? BUBBLE_RADIUS * 2 : 0;
  return { x: box.x + left, y: box.y, width: box.width - left - right, height: box.height };
}

export function gateBodyPath(symbol: GateSymbol, box: BodyBox): string {
  const { x, y, width: w, height: h } = shapeBox(symbol, box);
  switch (symbol.shape) {
    case 'and':
      return `M ${n(x)} ${n(y)} H ${n(x + w / 2)} A ${n(w / 2)} ${n(h / 2)} 0 0 1 ${n(x + w / 2)} ${n(y + h)} H ${n(x)} Z`;
    case 'or':
    case 'xor':
      return (
        `M ${n(x)} ${n(y)} Q ${n(x + 0.6 * w)} ${n(y)} ${n(x + w)} ${n(y + h / 2)} ` +
        `Q ${n(x + 0.6 * w)} ${n(y + h)} ${n(x)} ${n(y + h)} ` +
        `Q ${n(x + 0.25 * w)} ${n(y + h / 2)} ${n(x)} ${n(y)} Z`
      );
    case 'buffer':
      return `M ${n(x)} ${n(y)} L ${n(x + w)} ${n(y + h / 2)} L ${n(x)} ${n(y + h)} Z`;
  }
}

/** Дополнительная входная дуга XOR / XNOR. */
export function xorBackPath(box: BodyBox): string {
  const { x, y, width: w, height: h } = box;
  return `M ${n(x)} ${n(y)} Q ${n(x + 0.25 * (w - XOR_GAP))} ${n(y + h / 2)} ${n(x)} ${n(y + h)}`;
}

/** Глубина вогнутой задней стороны OR в точке `y` (квадратичная кривая Безье). */
function concaveDepth(box: BodyBox, width: number, y: number): number {
  const t = Math.min(1, Math.max(0, (y - box.y) / box.height));
  return 0.5 * width * t * (1 - t);
}

/** X-координата, где входная линия пина на высоте `y` касается корпуса. */
export function backEdgeX(symbol: GateSymbol, box: BodyBox, y: number): number {
  const inside = y >= box.y && y <= box.y + box.height;
  if (!inside || symbol.shape === 'and' || symbol.shape === 'buffer') return box.x;
  const width = symbol.shape === 'xor' ? box.width - XOR_GAP : shapeBox(symbol, box).width;
  return n(box.x + concaveDepth(box, width, y));
}

/** Точка, где начинается выходная линия: острие формы или правый край кружка инверсии. */
export function outputStartX(box: BodyBox): number {
  return box.x + box.width;
}

export function bubbleCenter(box: BodyBox): { cx: number; cy: number } {
  return { cx: box.x + box.width - BUBBLE_RADIUS, cy: box.y + box.height / 2 };
}

/** Продление задней стороны, если пины выходят за высоту корпуса; иначе `null`. */
export function backExtension(box: BodyBox, pinYs: readonly number[]): { y1: number; y2: number } | null {
  if (pinYs.length === 0) return null;
  const y1 = Math.min(box.y, ...pinYs);
  const y2 = Math.max(box.y + box.height, ...pinYs);
  return y1 < box.y || y2 > box.y + box.height ? { y1, y2 } : null;
}
