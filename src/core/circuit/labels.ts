import type { Circuit } from '../types/circuit';

/** Следующая свободная подпись вида `prefix1`, `prefix2`, … */
export function nextLabel(circuit: Circuit, prefix: string): string {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let max = 0;
  for (const component of circuit.components) {
    const match = component.label?.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${max + 1}`;
}
