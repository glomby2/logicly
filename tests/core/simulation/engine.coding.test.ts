import { describe, expect, it } from 'vitest';
import type { Signal } from '@/core/logic/signal';
import { netIdOf } from '@/core/simulation';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import { inverterRing } from '../../helpers/circuits';
import { knownCombinations } from '../../helpers/combinations';
import { expectFixpoint, read, setInput, simulate } from '../../helpers/simulation';

/*
 * DECODER, ENCODER, PRIORITY ENCODER и CONSTANT в схемах: движок вычисляет их через реестр,
 * без собственной логики (SimulationEngine на этапе 10 не менялся).
 */

const bitsOf = (value: number, count: number) => Array.from({ length: count }, (_, i) => ((value >> i) & 1) as 0 | 1);

describe('DECODER → ENCODER и PRIORITY ENCODER', () => {
  it.each([2, 3])('%i разряда: код восстанавливается для всех значений, V = 1', (bits) => {
    const lines = 2 ** bits;
    const b = new CircuitBuilder()
      .add('DEC', 'DECODER', { codeBits: bits })
      .add('ENC', 'ENCODER', { codeBits: bits })
      .add('PRI', 'PRIORITY_ENCODER', { codeBits: bits });
    for (let i = 0; i < bits; i++) b.input(`A${i}`).wire(`A${i}`, `DEC.a${i}`);
    for (let k = 0; k < lines; k++) b.wire(`DEC.y${k}`, `ENC.d${k}`).wire(`DEC.y${k}`, `PRI.d${k}`);
    const { engine } = simulate(b.build());

    for (const code of knownCombinations(bits)) {
      code.forEach((bit, i) => setInput(engine, `A${i}`, bit));
      const encoded = code.map((_, i) => read(engine, `ENC.a${i}`));
      const prioritized = code.map((_, i) => read(engine, `PRI.a${i}`));
      expect(encoded, code.join('')).toEqual(code);
      expect(prioritized, code.join('')).toEqual(code);
      expect(read(engine, 'PRI.v')).toBe(1);
      expectFixpoint(engine);
    }
  });
});

describe('каскад приоритетных шифраторов 16:4', () => {
  /**
   * Старший PRIORITY ENCODER 8:3 — на D8…D15, младший — на D0…D7. V старшего — разряд A3
   * и вход выбора трёх MUX 2:1: при активном старшем на A0…A2 его код, иначе — код младшего.
   */
  function cascade() {
    const b = new CircuitBuilder()
      .add('H', 'PRIORITY_ENCODER', { codeBits: 3 })
      .add('L', 'PRIORITY_ENCODER', { codeBits: 3 })
      .gate('V', 'OR')
      .wire('H.v', 'V.in0')
      .wire('L.v', 'V.in1');
    for (let i = 0; i < 16; i++) b.input(`D${i}`).wire(`D${i}`, i < 8 ? `L.d${i}` : `H.d${i - 8}`);
    for (let j = 0; j < 3; j++) {
      b.add(`M${j}`, 'MUX', { selectBits: 1 })
        .wire(`L.a${j}`, `M${j}.d0`)
        .wire(`H.a${j}`, `M${j}.d1`)
        .wire('H.v', `M${j}.s0`);
    }
    return b.build();
  }

  const reference = (inputs: number): Signal[] => {
    if (inputs === 0) return [0, 0, 0, 0, 0];
    return [...bitsOf(31 - Math.clz32(inputs), 4), 1];
  };

  it('полный перебор 2¹⁶ наборов в порядке кода Грея совпадает с эталоном', () => {
    const { engine } = simulate(cascade());
    const outputs = () => [read(engine, 'M0.y'), read(engine, 'M1.y'), read(engine, 'M2.y'), read(engine, 'H.v'), read(engine, 'V')];
    expect(outputs()).toEqual(reference(0));

    let inputs = 0;
    for (let step = 1; step < 2 ** 16; step++) {
      const bit = 31 - Math.clz32(step & -step); // разряд, который меняется в коде Грея
      inputs ^= 1 << bit;
      setInput(engine, `D${bit}`, (inputs >> bit) & 1 ? 1 : 0);
      const actual = outputs();
      const expected = reference(inputs);
      // expect — только при расхождении: 65 536 наборов.
      if (actual.some((v, i) => v !== expected[i])) expect(actual, inputs.toString(2)).toEqual(expected);
    }
    expect(inputs).toBe(1 << 15); // последний код Грея 2¹⁶ − 1 — это 1000…0
  });
});

describe('полный сумматор на DECODER 3:8 и OR', () => {
  it('S = OR(Y1, Y2, Y4, Y7), Cout = OR(Y3, Y5, Y6, Y7) на всех 8 наборах', () => {
    const b = new CircuitBuilder()
      .input('A')
      .input('B')
      .input('C')
      .add('DEC', 'DECODER', { codeBits: 3 })
      .gate('S', 'OR', 4)
      .gate('CO', 'OR', 4)
      .wire('A', 'DEC.a0')
      .wire('B', 'DEC.a1')
      .wire('C', 'DEC.a2');
    [1, 2, 4, 7].forEach((y, i) => b.wire(`DEC.y${y}`, `S.in${i}`));
    [3, 5, 6, 7].forEach((y, i) => b.wire(`DEC.y${y}`, `CO.in${i}`));
    const { engine } = simulate(b.build());

    for (const [a, bIn, c] of knownCombinations(3)) {
      setInput(engine, 'A', a!);
      setInput(engine, 'B', bIn!);
      setInput(engine, 'C', c!);
      const sum = a! + bIn! + c!;
      expect([read(engine, 'S'), read(engine, 'CO')], `${a}${bIn}${c}`).toEqual([sum & 1, sum >= 2 ? 1 : 0]);
    }
  });
});

describe('неизвестные значения', () => {
  it('X из нестабильной петли на A0 DECODER: возможные выходы X, исключённые — 0; unknownNets', () => {
    const circuit = inverterRing(1).add('DEC', 'DECODER', { codeBits: 2 }).wire('N0', 'DEC.a0').build();
    const { engine, result } = simulate(circuit);
    expect(read(engine, 'N0')).toBe('X');
    expect([0, 1, 2, 3].map((k) => read(engine, `DEC.y${k}`))).toEqual(['X', 'X', 0, 0]);
    const net = (pin: string) => netIdOf({ componentId: 'DEC', pinId: pin });
    expect(result.unknownNets).toEqual(expect.arrayContaining([net('y0'), net('y1')]));
    expect(result.unknownNets).not.toContain(net('y2'));
    expect(result.unknownNets).not.toContain(net('y3'));
  });

  it('PRIORITY ENCODER: D3 = X (петля), D2 = 1 → A1 = 1, A0 = X, V = 1', () => {
    const circuit = inverterRing(1)
      .input('D2', true)
      .add('PRI', 'PRIORITY_ENCODER', { codeBits: 2 })
      .wire('N0', 'PRI.d3')
      .wire('D2', 'PRI.d2')
      .build();
    const { engine } = simulate(circuit);
    expect([read(engine, 'PRI.a1'), read(engine, 'PRI.a0'), read(engine, 'PRI.v')]).toEqual([1, 'X', 1]);
  });
});

describe('CONSTANT', () => {
  it('CONSTANT 1 на входе AND: выход следует за вторым входом; смена уровня — без перекомпиляции', () => {
    const circuit = new CircuitBuilder()
      .add('K', 'CONSTANT', { level: true })
      .input('B')
      .gate('G', 'AND')
      .wire('K', 'G.in0')
      .wire('B', 'G.in1')
      .build();
    const { engine } = simulate(circuit);
    expect(read(engine, 'K')).toBe(1);
    expect(read(engine, 'G')).toBe(0);
    setInput(engine, 'B', 1);
    expect(read(engine, 'G')).toBe(1);

    // Набор пинов не меняется — setProps не требует перекомпиляции (иначе бросил бы ошибку).
    engine.setProps('K', { level: false });
    engine.settle();
    expect([read(engine, 'K'), read(engine, 'G')]).toEqual([0, 0]);
  });
});
