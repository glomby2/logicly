import { SIGNALS, type KnownSignal, type Signal } from '@/core/logic/signal';

/** Все наборы длины `length` из значений `values` (декартова степень). */
export function combinations<T>(length: number, values: readonly T[]): T[][] {
  let result: T[][] = [[]];
  for (let i = 0; i < length; i++) {
    result = result.flatMap((prefix) => values.map((value) => [...prefix, value]));
  }
  return result;
}

export const knownCombinations = (length: number): KnownSignal[][] => combinations<KnownSignal>(length, [0, 1]);

export const ternaryCombinations = (length: number): Signal[][] => combinations(length, SIGNALS);

/** Можно ли получить `b` из `a`, заменив часть значений на X (a уточняет b). */
export function refines(a: readonly Signal[], b: readonly Signal[]): boolean {
  return a.every((value, i) => b[i] === 'X' || b[i] === value);
}
