import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { compileCircuit, SimulationEngine } from '@/core/simulation';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import { halfAdder, rippleCarryAdder } from '../../helpers/circuits';
import { knownCombinations } from '../../helpers/combinations';
import { expectFixpoint, read, setInput, simulate } from '../../helpers/simulation';

const reference: Record<string, (inputs: number[]) => number> = {
  AND: (i) => Number(i.every(Boolean)),
  OR: (i) => Number(i.some(Boolean)),
  NAND: (i) => Number(!i.every(Boolean)),
  NOR: (i) => Number(!i.some(Boolean)),
  XOR: (i) => i.filter(Boolean).length % 2,
  XNOR: (i) => 1 - (i.filter(Boolean).length % 2),
};

/** INPUT × n → вентиль → OUTPUT. */
function gateCircuit(type: string, inputs: number) {
  const b = new CircuitBuilder().gate('G', type, inputs).output('L').wire('G', 'L');
  for (let i = 0; i < inputs; i++) b.input(`I${i}`).wire(`I${i}`, `G.in${i}`);
  return b.build();
}

describe('вентили в схеме', () => {
  for (const [type, expected] of Object.entries(reference)) {
    it.each([2, 3])(`${type} с %i входами совпадает с таблицей истинности`, (count) => {
      const { engine } = simulate(gateCircuit(type, count));
      for (const combo of knownCombinations(count)) {
        combo.forEach((value, i) => setInput(engine, `I${i}`, value));
        expect(read(engine, 'L'), combo.join('')).toBe(expected(combo));
      }
    });
  }

  it('NOT', () => {
    const { engine } = simulate(new CircuitBuilder().input('A').gate('N', 'NOT').wire('A', 'N').build());
    expect(read(engine, 'N')).toBe(1);
    setInput(engine, 'A', 1);
    expect(read(engine, 'N')).toBe(0);
  });
});

describe('неподключённые входы', () => {
  it('читаются как 0', () => {
    const circuit = new CircuitBuilder()
      .input('A', true)
      .gate('AND', 'AND')
      .gate('OR', 'OR')
      .gate('NOT', 'NOT')
      .gate('NAND', 'NAND')
      .output('L')
      .wire('A', 'AND.in0')
      .wire('A', 'OR.in0')
      .build();
    const { engine } = simulate(circuit);
    expect(read(engine, 'AND')).toBe(0);
    expect(read(engine, 'OR')).toBe(1);
    expect(read(engine, 'NOT')).toBe(1);
    expect(read(engine, 'NAND')).toBe(1);
    expect(read(engine, 'L')).toBe(0);
    expect(engine.getPinValue({ componentId: 'AND', pinId: 'in1' })).toBe(0);
  });
});

describe('сумматоры', () => {
  it('полусумматор', () => {
    const { engine } = simulate(halfAdder().build());
    for (const [a, b] of knownCombinations(2)) {
      setInput(engine, 'A', a!);
      setInput(engine, 'B', b!);
      expect([read(engine, 'SUM'), read(engine, 'CARRY')], `${a}${b}`).toEqual([(a! + b!) % 2, (a! + b!) >> 1]);
    }
  });

  it('4-разрядный сумматор с переносом: все 512 комбинаций', () => {
    const bits = 4;
    const { engine } = simulate(rippleCarryAdder(bits).build());
    for (let cin = 0; cin < 2; cin++) {
      for (let a = 0; a < 1 << bits; a++) {
        for (let b = 0; b < 1 << bits; b++) {
          setInput(engine, 'CIN', cin as 0 | 1);
          for (let i = 0; i < bits; i++) {
            setInput(engine, `A${i}`, ((a >> i) & 1) as 0 | 1);
            setInput(engine, `B${i}`, ((b >> i) & 1) as 0 | 1);
          }
          let sum = Number(read(engine, 'COUT')) << bits;
          for (let i = 0; i < bits; i++) sum |= Number(read(engine, `S${i}`)) << i;
          expect(sum, `${a} + ${b} + ${cin}`).toBe(a + b + cin);
        }
      }
    }
    expectFixpoint(engine);
  });
});

describe('эффективность и инкрементальность', () => {
  it('в схеме без петель каждый элемент при полном расчёте вычисляется ровно один раз', () => {
    const { netlist, result } = simulate(rippleCarryAdder(8).build());
    expect(result.status).toBe('stable');
    expect(result.evaluations).toBe(netlist.components.length);
  });

  it('переключение входа пересчитывает только зависимую часть схемы', () => {
    const { netlist, engine } = simulate(rippleCarryAdder(8).build());
    // A7 влияет только на старший полный сумматор и выходы S7 и COUT.
    const result = setInput(engine, 'A7', 1);
    expect(result.evaluations).toBeLessThan(10);
    expect(result.evaluations).toBeLessThan(netlist.components.length / 5);
  });

  it('повторная установка того же значения не вызывает распространения', () => {
    const { engine } = simulate(halfAdder().build());
    expect(setInput(engine, 'A', 0).evaluations).toBe(1);
  });
});

describe('API движка', () => {
  it('setProps с изменением набора пинов требует перекомпиляции', () => {
    const { engine } = simulate(gateCircuit('AND', 2));
    expect(() => engine.setProps('G', { inputCount: 3 })).toThrow(/перекомпиляции/);
    expect(() => engine.setProps('NOPE', {})).toThrow(/отсутствует/);
  });

  it('getPinValue / getNetValue для несуществующих пинов возвращают undefined', () => {
    const { engine } = simulate(gateCircuit('AND', 2));
    expect(engine.getPinValue({ componentId: 'G', pinId: 'in7' })).toBeUndefined();
    expect(engine.getPinValue({ componentId: 'NOPE', pinId: 'out0' })).toBeUndefined();
    expect(engine.getNetValue('NOPE:out0')).toBeUndefined();
    expect(engine.getNetValue('G:out0')).toBe(0);
  });

  it('getSignals возвращает значения всех сетей', () => {
    const { engine } = simulate(halfAdder().build());
    setInput(engine, 'A', 1);
    expect(engine.getSignals()).toEqual({ 'A:out0': 1, 'B:out0': 0, 'X:out0': 1, 'C:out0': 0 });
  });

  it('до settle() значения не пересчитываются', () => {
    const engine = new SimulationEngine(compileCircuit(halfAdder().build(), createDefaultRegistry()));
    expect(read(engine, 'X')).toBe(0);
    engine.setProps('A', { value: true });
    expect(read(engine, 'X')).toBe(0);
    engine.settle();
    expect(read(engine, 'X')).toBe(1);
  });

  it('reset возвращает состояние включения', () => {
    const { engine } = simulate(halfAdder().build());
    setInput(engine, 'A', 1);
    setInput(engine, 'B', 1);
    engine.reset();
    // Свойства (положения переключателей) сохраняются — сбрасываются только сигналы и состояния.
    const result = engine.settle();
    expect(result.status).toBe('stable');
    expect([read(engine, 'SUM'), read(engine, 'CARRY')]).toEqual([0, 1]);
    expect(engine.time).toBe(0);
  });
});
