import type { ElementPins, PinDirection, PinSide, PinSpec } from '@/core/types/element';

/** Шаг пинов и сетки рабочего поля, px. */
export const PIN_PITCH = 20;
/** Размер видимой точки пина, px. */
export const HANDLE_SIZE = 12;

/**
 * Вид узла на поле: вентиль с ANSI-символом, переключатель, индикатор, трапеция MUX / DEMUX
 * или универсальный прямоугольник.
 */
export type NodeKind = 'gate' | 'input' | 'output' | 'mux' | 'box';

export interface PinGeometry {
  readonly id: string;
  readonly direction: PinDirection;
  readonly side: PinSide;
  /** Координаты точки подключения относительно левого верхнего угла узла. */
  readonly x: number;
  readonly y: number;
  readonly label?: string;
}

export interface ElementGeometry {
  readonly kind: NodeKind;
  readonly width: number;
  readonly height: number;
  readonly pins: readonly PinGeometry[];
}

const GATE_WIDTH = 80;
const IO_HEIGHT = 40;
const INPUT_WIDTH = 72;
const OUTPUT_WIDTH = 56;
const BOX_WIDTH = 100;
const MUX_WIDTH = 80;

function pointOnSide(side: PinSide, offset: number, width: number, height: number) {
  switch (side) {
    case 'left':
      return { x: 0, y: offset };
    case 'right':
      return { x: width, y: offset };
    case 'top':
      return { x: offset, y: 0 };
    case 'bottom':
      return { x: offset, y: height };
  }
}

/** Пины, равномерно расставленные по стороне с шагом PIN_PITCH, отступ — один шаг. */
function placeAlong(
  specs: readonly PinSpec[],
  direction: PinDirection,
  side: PinSide,
  width: number,
  height: number,
): PinGeometry[] {
  return specs.map((spec, i) => ({
    id: spec.id,
    direction,
    side,
    ...pointOnSide(side, (i + 1) * PIN_PITCH, width, height),
    ...(spec.label ? { label: spec.label } : {}),
  }));
}

function gateGeometry(pins: ElementPins): ElementGeometry {
  const rows = Math.max(pins.inputs.length, 1);
  const height = (rows + 1) * PIN_PITCH;
  const inputs = placeAlong(pins.inputs, 'input', 'left', GATE_WIDTH, height);
  const outputs = pins.outputs.map(
    (spec): PinGeometry => ({ id: spec.id, direction: 'output', side: 'right', x: GATE_WIDTH, y: height / 2 }),
  );
  return { kind: 'gate', width: GATE_WIDTH, height, pins: [...inputs, ...outputs] };
}

function ioGeometry(kind: 'input' | 'output', pins: ElementPins): ElementGeometry {
  const width = kind === 'input' ? INPUT_WIDTH : OUTPUT_WIDTH;
  const center = IO_HEIGHT / 2;
  return {
    kind,
    width,
    height: IO_HEIGHT,
    pins: [
      ...pins.inputs.map((spec): PinGeometry => ({ id: spec.id, direction: 'input', side: 'left', x: 0, y: center })),
      ...pins.outputs.map(
        (spec): PinGeometry => ({ id: spec.id, direction: 'output', side: 'right', x: width, y: center }),
      ),
    ],
  };
}

/** Универсальный прямоугольник: пины на сторонах из `PinSpec.side` (входы слева, выходы справа по умолчанию). */
function boxGeometry(pins: ElementPins): ElementGeometry {
  const all = [
    ...pins.inputs.map((spec) => ({ spec, direction: 'input' as const, side: spec.side ?? 'left' })),
    ...pins.outputs.map((spec) => ({ spec, direction: 'output' as const, side: spec.side ?? 'right' })),
  ];
  const onSide = (side: PinSide) => all.filter((p) => p.side === side);
  const height = (Math.max(onSide('left').length, onSide('right').length, 2) + 1) * PIN_PITCH;
  const width = Math.max(BOX_WIDTH, (Math.max(onSide('top').length, onSide('bottom').length) + 1) * PIN_PITCH);

  const sides: PinSide[] = ['left', 'right', 'top', 'bottom'];
  const placed = sides.flatMap((side) =>
    onSide(side).map(
      (p, i): PinGeometry => ({
        id: p.spec.id,
        direction: p.direction,
        side,
        ...pointOnSide(side, (i + 1) * PIN_PITCH, width, height),
        ...(p.spec.label ? { label: p.spec.label } : {}),
      }),
    ),
  );
  return { kind: 'box', width, height, pins: placed };
}

/** Смещения `count` пинов с шагом PIN_PITCH, отцентрированных на стороне длиной `length`. */
function centeredOffsets(count: number, length: number): number[] {
  const start = (length - (count - 1) * PIN_PITCH) / 2;
  return Array.from({ length: count }, (_, i) => start + i * PIN_PITCH);
}

/**
 * MUX / DEMUX (трапеция): входы слева, входы с `side: 'bottom'` (выбор) снизу, выходы справа.
 * Пины каждой стороны центрируются с шагом PIN_PITCH: на стороне с наибольшим числом пинов
 * они идут от одного шага до края, одиночный пин (выход MUX, вход DEMUX) — посередине.
 */
function muxGeometry(pins: ElementPins): ElementGeometry {
  const left = pins.inputs.filter((spec) => spec.side !== 'bottom');
  const bottom = pins.inputs.filter((spec) => spec.side === 'bottom');
  const right = pins.outputs;
  const height = (Math.max(left.length, right.length, 2) + 1) * PIN_PITCH;
  const width = Math.max(MUX_WIDTH, (bottom.length + 1) * PIN_PITCH);

  const place = (specs: readonly PinSpec[], direction: PinDirection, side: PinSide, length: number) => {
    const offsets = centeredOffsets(specs.length, length);
    return specs.map(
      (spec, i): PinGeometry => ({
        id: spec.id,
        direction,
        side,
        ...pointOnSide(side, offsets[i]!, width, height),
        ...(spec.label ? { label: spec.label } : {}),
      }),
    );
  };
  return {
    kind: 'mux',
    width,
    height,
    pins: [...place(left, 'input', 'left', height), ...place(bottom, 'input', 'bottom', width), ...place(right, 'output', 'right', height)],
  };
}

export function computeGeometry(kind: NodeKind, pins: ElementPins): ElementGeometry {
  switch (kind) {
    case 'gate':
      return gateGeometry(pins);
    case 'input':
    case 'output':
      return ioGeometry(kind, pins);
    case 'mux':
      return muxGeometry(pins);
    case 'box':
      return boxGeometry(pins);
  }
}
