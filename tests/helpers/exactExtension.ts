import type { KnownSignal, Signal } from '@/core/logic/signal';
import { knownCombinations } from './combinations';

/**
 * Точное троичное расширение двоичной функции: каждый выход — общее значение по всем способам
 * заменить X на 0 или 1 (иначе X). Строже этого монотонный элемент быть не может.
 */
export function exactExtension(f: (inputs: readonly KnownSignal[]) => readonly Signal[], inputs: readonly Signal[]): Signal[] {
  const unknown = inputs.flatMap((v, i) => (v === 'X' ? [i] : []));
  let result: Signal[] | undefined;
  for (const fill of knownCombinations(unknown.length)) {
    const known = inputs.map((v) => (v === 'X' ? 0 : v)) as KnownSignal[];
    unknown.forEach((index, k) => (known[index] = fill[k]!));
    const outputs = f(known);
    result = result ? result.map((v, i) => (v === outputs[i] ? v : 'X')) : [...outputs];
  }
  return result!;
}
