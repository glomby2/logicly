import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { parseCircuitFile, serializeCircuit } from '@/core/serialization';
import type { Circuit, CircuitComponent, ElementProps, Wire } from '@/core/types/circuit';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import { halfAdder, norLatch, rippleCarryAdder } from '../../helpers/circuits';
import { normalized } from '../../helpers/files';
import { createRandom } from '../../helpers/simulation';

const registry = createDefaultRegistry();

function expectRoundTrip(circuit: Circuit, name = 'Схема') {
  const text = serializeCircuit(circuit, name);
  const result = parseCircuitFile(text, registry);
  if (!result.ok) throw new Error(`Файл отклонён: ${JSON.stringify(result.errors)}`);
  expect(result.warnings).toEqual([]);
  expect(result.circuit).toEqual(circuit);
  expect(result.name).toBe(name);
  // Повторное сохранение даёт тот же текст.
  expect(serializeCircuit(result.circuit, result.name)).toBe(text);
}

const GATES = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'NOT'];

/** Случайная схема со всеми видами данных: позиции, подписи, число входов, положения INPUT, петли. */
function randomCircuit(random: () => number): Circuit {
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  const components: CircuitComponent[] = [];
  const count = 1 + Math.floor(random() * 30);
  for (let i = 0; i < count; i++) {
    const type = random() < 0.2 ? 'INPUT' : random() < 0.1 ? 'OUTPUT' : pick(GATES);
    const props: ElementProps =
      type === 'INPUT' ? { value: random() < 0.5 } : type === 'OUTPUT' || type === 'NOT' ? {} : { inputCount: 2 + Math.floor(random() * 7) };
    components.push({
      id: `${type.toLowerCase()}-${i}`,
      type,
      // `|| 0`: JSON записывает −0 как 0, а в редакторе −0 и 0 — одна и та же позиция.
      position: { x: Math.round(random() * 2000 - 1000) || 0, y: Math.round(random() * 2000 - 1000) / 10 || 0 },
      ...(random() < 0.4 ? { label: `L${i} «подпись»` } : {}),
      props,
    });
  }
  const wires: Wire[] = [];
  for (let k = 0; k < count * 2; k++) {
    const from = pick(components);
    const to = pick(components);
    wires.push({
      id: `w-${k}`,
      from: { componentId: from.id, pinId: 'out0' },
      to: { componentId: to.id, pinId: `in${Math.floor(random() * 8)}` },
    });
  }
  // Недопустимые провода отбрасываются нормализацией: в схеме редактора их не бывает.
  return normalized({ components, wires }, registry);
}

describe('сохранение → загрузка даёт ту же схему', () => {
  it('пустая схема', () => expectRoundTrip({ components: [], wires: [] }, ''));

  it('полусумматор', () => expectRoundTrip(normalized(halfAdder().build(), registry)));

  it('RS-защёлка с обратной связью и 4-разрядный сумматор', () => {
    expectRoundTrip(normalized(norLatch().build(), registry), 'RS-защёлка');
    expectRoundTrip(normalized(rippleCarryAdder(4).build(), registry), 'Сумматор');
  });

  it('подписи, n-входовые вентили, включённые INPUT, петля на себя', () => {
    const circuit = normalized(
      new CircuitBuilder().input('A', true).gate('G', 'NAND', 8).gate('N', 'NOT').wire('A', 'G.in7').wire('N', 'N').build(),
      registry,
    );
    const labelled = { ...circuit, components: circuit.components.map((c) => ({ ...c, label: `${c.id}: "кавычки" \\` })) };
    expectRoundTrip(labelled, 'Имя с "кавычками" и /слешами/');
  });

  it('200 случайных схем', () => {
    const random = createRandom(6);
    for (let trial = 0; trial < 200; trial++) expectRoundTrip(randomCircuit(random), `Схема ${trial}`);
  });
});
