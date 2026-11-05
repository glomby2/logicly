import { describe, expect, it } from 'vitest';
import type { Circuit } from '@/core/types/circuit';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import { createRandom, expectFixpoint, setInput, simulate } from '../../helpers/simulation';

const GATE_TYPES = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'NOT'];
const INPUTS = 3;
const GATES = 25;

/** Случайная схема: любой вход вентиля может быть подключён к любому выходу, включая собственный. */
function randomCircuit(random: () => number): Circuit {
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  const b = new CircuitBuilder();
  const sources: string[] = [];

  for (let i = 0; i < INPUTS; i++) {
    b.input(`I${i}`, random() < 0.5);
    sources.push(`I${i}`);
  }
  const gates: [id: string, inputs: number][] = [];
  for (let g = 0; g < GATES; g++) {
    const type = pick(GATE_TYPES);
    const inputs = type === 'NOT' ? 1 : 2 + Math.floor(random() * 2);
    b.gate(`G${g}`, type, type === 'NOT' ? undefined : inputs);
    gates.push([`G${g}`, inputs]);
    sources.push(`G${g}`);
  }
  for (const [id, inputs] of gates) {
    for (let k = 0; k < inputs; k++) {
      if (random() < 0.9) b.wire(pick(sources), `${id}.in${k}`);
    }
  }
  return b.build();
}

describe('случайные схемы с обратными связями', () => {
  it('расчёт всегда завершается в неподвижной точке — 200 схем × 10 переключений', () => {
    const random = createRandom(2024);
    const statuses = { stable: 0, oscillation: 0 };
    // Доказанная верхняя граница: изменений выходов не больше n·(порог + 1) + 2·(число сетей),
    // каждое ставит в очередь не больше n читателей; плюс начальная очередь и проход уточнения.
    const n = INPUTS + GATES;
    const evaluationLimit = 2 * n + (n * (64 + 1) + 2 * n) * n + n * n;
    let maxObserved = 0;

    for (let trial = 0; trial < 200; trial++) {
      const { engine, netlist, result } = simulate(randomCircuit(random));
      expect(netlist.diagnostics).toEqual([]);
      statuses[result.status]++;
      expectFixpoint(engine);

      for (let step = 0; step < 10; step++) {
        const toggled = setInput(engine, `I${Math.floor(random() * INPUTS)}`, random() < 0.5);
        statuses[toggled.status]++;
        maxObserved = Math.max(maxObserved, toggled.evaluations);
        expectFixpoint(engine);
      }
    }

    expect(maxObserved).toBeLessThan(evaluationLimit);
    // Набор действительно содержит и устойчивые, и колеблющиеся схемы.
    expect(statuses.stable).toBeGreaterThan(0);
    expect(statuses.oscillation).toBeGreaterThan(0);
  });

  it('результат детерминирован: одна и та же схема даёт одинаковые сигналы', () => {
    const random = createRandom(99);
    for (let trial = 0; trial < 50; trial++) {
      const circuit = randomCircuit(random);
      expect(simulate(circuit).engine.getSignals()).toEqual(simulate(circuit).engine.getSignals());
    }
  });
});
