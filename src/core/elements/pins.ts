import type { PinId } from '../types/circuit';
import type { PinSpec } from '../types/element';

export function inputPinId(index: number): PinId {
  return `in${index}`;
}

export function outputPinId(index: number): PinId {
  return `out${index}`;
}

/** Пины с id вида `in0..inN` / `out0..outN`. */
export function indexedPins(count: number, makeId: (index: number) => PinId): PinSpec[] {
  return Array.from({ length: count }, (_, index) => ({ id: makeId(index) }));
}
