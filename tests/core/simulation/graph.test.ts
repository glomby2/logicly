import { describe, expect, it } from 'vitest';
import { analyzeGraph } from '@/core/simulation';
import { createRandom } from '../../helpers/simulation';

describe('analyzeGraph', () => {
  it('для графа без циклов ранги образуют топологический порядок', () => {
    const random = createRandom(7);
    for (let trial = 0; trial < 50; trial++) {
      const count = 40;
      // Случайная перестановка задаёт порядок, рёбра идут только «вперёд» — циклов нет.
      const order = Array.from({ length: count }, (_, i) => i).sort(() => random() - 0.5);
      const successors: number[][] = Array.from({ length: count }, () => []);
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          if (random() < 0.1) successors[order[i]!]!.push(order[j]!);
        }
      }
      const { rank, inCycle } = analyzeGraph(successors);
      successors.forEach((targets, u) => targets.forEach((v) => expect(rank[u]).toBeLessThan(rank[v]!)));
      expect(inCycle.every((c) => !c)).toBe(true);
      expect(new Set(rank).size).toBe(count);
    }
  });

  it('находит петлю на себя и циклы, не помечая остальные узлы', () => {
    // 0 → 1 → 2 → 1 (цикл 1–2), 3 → 3 (петля), 4 — изолированный, 2 → 5.
    const { inCycle } = analyzeGraph([[1], [2], [1, 5], [3], [], []]);
    expect(inCycle).toEqual([false, true, true, true, false, false]);
  });

  it('источники получают наименьшие ранги', () => {
    // Узел 2 — единственный источник, хотя у него больший индекс.
    const { rank } = analyzeGraph([[1], [0], [0]]);
    expect(rank[2]).toBe(0);
  });

  it('не переполняет стек на длинной цепочке', () => {
    const count = 100_000;
    const successors = Array.from({ length: count }, (_, i) => (i + 1 < count ? [i + 1] : []));
    const { rank } = analyzeGraph(successors);
    expect(rank[0]).toBe(0);
    expect(rank[count - 1]).toBe(count - 1);
  });
});
