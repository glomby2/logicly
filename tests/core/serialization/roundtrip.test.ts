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

const GATES = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'NOT', 'BUFFER', 'MUX', 'DEMUX'];

function randomProps(type: string, random: () => number): ElementProps {
  switch (type) {
    case 'INPUT':
      return { value: random() < 0.5 };
    case 'OUTPUT':
    case 'NOT':
    case 'BUFFER':
      return {};
    case 'MUX':
    case 'DEMUX':
      return { selectBits: 1 + Math.floor(random() * 3) };
    default:
      return { inputCount: 2 + Math.floor(random() * 7) };
  }
}

/** Случайная схема со всеми видами данных: позиции, подписи, число входов и выходов, положения INPUT, петли. */
function randomCircuit(random: () => number): Circuit {
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  const components: CircuitComponent[] = [];
  const count = 1 + Math.floor(random() * 30);
  for (let i = 0; i < count; i++) {
    const type = random() < 0.2 ? 'INPUT' : random() < 0.1 ? 'OUTPUT' : pick(GATES);
    const props = randomProps(type, random);
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
    // Пины — из определения элемента (у MUX и DEMUX id по роли: d0, s0, y, y0…).
    const outputs = registry.require(from.type).pins(from.props).outputs;
    const inputs = registry.require(to.type).pins(to.props).inputs;
    if (outputs.length === 0 || inputs.length === 0) continue;
    wires.push({
      id: `w-${k}`,
      from: { componentId: from.id, pinId: pick(outputs).id },
      to: { componentId: to.id, pinId: pick(inputs).id },
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

  it('BUFFER, MUX и DEMUX всех разрядностей с проводами на пины по роли', () => {
    const builder = new CircuitBuilder().input('A', true).input('S').gate('B', 'BUFFER').wire('A', 'B');
    for (const bits of [1, 2, 3]) {
      builder
        .add(`M${bits}`, 'MUX', { selectBits: bits })
        .add(`D${bits}`, 'DEMUX', { selectBits: bits })
        .wire('B', `M${bits}.d${2 ** bits - 1}`)
        .wire('S', `M${bits}.s${bits - 1}`)
        .wire(`M${bits}.y`, `D${bits}.d`)
        .wire('S', `D${bits}.s0`)
        .output(`Y${bits}`)
        .wire(`D${bits}.y${2 ** bits - 1}`, `Y${bits}`);
    }
    const circuit = normalized(builder.build(), registry);
    expect(circuit.wires).toHaveLength(1 + 3 * 5);
    expectRoundTrip(circuit, 'Мультиплексоры');
  });

  it('DECODER, ENCODER, PRIORITY ENCODER обеих разрядностей и CONSTANT 0/1 с проводами на пины по роли', () => {
    const builder = new CircuitBuilder().add('K1', 'CONSTANT', { level: true }).add('K0', 'CONSTANT', { level: false });
    for (const bits of [2, 3]) {
      const top = 2 ** bits - 1;
      builder
        .add(`DEC${bits}`, 'DECODER', { codeBits: bits })
        .add(`ENC${bits}`, 'ENCODER', { codeBits: bits })
        .add(`PRI${bits}`, 'PRIORITY_ENCODER', { codeBits: bits })
        .wire('K1', `DEC${bits}.a${bits - 1}`)
        .wire('K0', `DEC${bits}.a0`)
        .wire(`DEC${bits}.y${top}`, `ENC${bits}.d${top}`)
        .wire(`DEC${bits}.y${top}`, `PRI${bits}.d${top}`)
        .output(`V${bits}`)
        .wire(`PRI${bits}.v`, `V${bits}`)
        .output(`A${bits}`)
        .wire(`ENC${bits}.a${bits - 1}`, `A${bits}`);
    }
    const circuit = normalized(builder.build(), registry);
    // По 6 проводов на разрядность: нормализация ни одного не удалила.
    expect(circuit.wires).toHaveLength(2 * 6);
    expectRoundTrip(circuit, 'Шифраторы');
  });

  it('200 случайных схем', () => {
    const random = createRandom(6);
    for (let trial = 0; trial < 200; trial++) expectRoundTrip(randomCircuit(random), `Схема ${trial}`);
  });
});
