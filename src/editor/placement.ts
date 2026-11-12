import type { Point } from '@/core/types/circuit';

/** MIME-тип перетаскивания элемента из палитры. */
export const ELEMENT_DRAG_TYPE = 'application/x-logic-element';

/** Ширина окна, начиная с которой палитра постоянно видна (Tailwind `md`). */
export const WIDE_SCREEN = 768;

/** Шаг привязки к сетке, px. */
export const SNAP_STEP = 10;

export function snapPoint(point: Point, step = SNAP_STEP): Point {
  return { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step };
}

/** Позиция нового элемента: центр примерно под курсором, с привязкой к сетке. */
export function placementPosition(pointer: Point): Point {
  return snapPoint({ x: pointer.x - 40, y: pointer.y - 30 });
}
