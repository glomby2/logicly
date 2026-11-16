import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { compileCircuit, SimulationEngine } from '@/core/simulation';
import type { Circuit } from '@/core/types/circuit';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import { TEST_CLOCK, TEST_DFF } from '../../helpers/fixtureElements';
import { expectFixpoint, read, setInput, simulate } from '../../helpers/simulation';

/*
 * Синхронная логика: несколько триггеров с общим тактом.
 *
 * Все триггеры, сработавшие от одного фронта, должны захватить данные из состояния
 * до фронта (как в железе, где задержка «такт → Q» больше времени удержания).
 * При включении и при добавлении триггера фронта нет. Результат не зависит
 * от порядка элементов и проводов в схеме.
 *
 * Сценарии выполняются для тестового D-триггера (TEST_DFF) и для элемента реестра
 * D_FLIP_FLOP: id пинов у них совпадают (d, clk → q, qn).
 */

function registry() {
  const r = createDefaultRegistry();
  r.register(TEST_CLOCK);
  r.register(TEST_DFF);
  return r;
}

/** Та же схема с элементами и проводами в обратном порядке. */
const reversed = (circuit: Circuit): Circuit => ({
  components: [...circuit.components].reverse(),
  wires: [...circuit.wires].reverse(),
});

/** Значения Q триггеров `ids` строкой: «101». */
const bits = (engine: SimulationEngine, ids: readonly string[]) => ids.map((id) => read(engine, `${id}.q`)).join('');

/** Передний и задний фронт ручного такта на INPUT `C`; после каждого фронта — проверка неподвижной точки. */
function pulse(engine: SimulationEngine) {
  setInput(engine, 'C', 1);
  expectFixpoint(engine);
  setInput(engine, 'C', 0);
  expectFixpoint(engine);
}

/** Сдвиговый регистр D → F0 → F1 → … с общим ручным тактом C. */
function shiftRegister(ff: string, stages: number) {
  const b = new CircuitBuilder().input('D').input('C');
  for (let i = 0; i < stages; i++) {
    b.add(`F${i}`, ff).wire(i === 0 ? 'D' : `F${i - 1}.q`, `F${i}.d`).wire('C', `F${i}.clk`);
  }
  return b.build();
}

/** Счётчик Джонсона на двух триггерах: F0.d = Q̄1, F1.d = Q0. Последовательность Q0Q1: 00 → 10 → 11 → 01 → 00. */
function johnsonCounter(ff: string) {
  return new CircuitBuilder()
    .input('C')
    .add('F0', ff)
    .add('F1', ff)
    .wire('F1.qn', 'F0.d')
    .wire('F0.q', 'F1.d')
    .wire('C', 'F0.clk')
    .wire('C', 'F1.clk')
    .build();
}

/** Асинхронный (пульсирующий) счётчик: F0 от генератора, F(i) тактируется Q̄(i−1), Q̄ → D. */
function rippleCounter(ff: string, stages: number) {
  const b = new CircuitBuilder().add('K', 'TEST_CLOCK');
  for (let i = 0; i < stages; i++) {
    b.add(`F${i}`, ff).wire(i === 0 ? 'K' : `F${i - 1}.qn`, `F${i}.clk`).wire(`F${i}.qn`, `F${i}.d`);
  }
  return b.build();
}

/** Значение счётчика: F0 — младший разряд. */
const count = (engine: SimulationEngine, stages: number) =>
  Array.from({ length: stages }, (_, i) => (read(engine, `F${i}.q`) === 1 ? 2 ** i : 0)).reduce((a, b) => a + b, 0);

describe.each(['TEST_DFF', 'D_FLIP_FLOP'])('%s', (ff) => {
  describe('триггеры с общим тактом захватывают данные до фронта', () => {
    it('сдвиговый регистр сдвигает ровно на один разряд за фронт', () => {
      const { engine } = simulate(shiftRegister(ff, 4), registry());
      setInput(engine, 'D', 1);
      const ids = ['F0', 'F1', 'F2', 'F3'];
      const trace = [bits(engine, ids)];
      for (let i = 0; i < 4; i++) {
        pulse(engine);
        trace.push(bits(engine, ids));
      }
      expect(trace).toEqual(['0000', '1000', '1100', '1110', '1111']);

      setInput(engine, 'D', 0);
      pulse(engine);
      expect(bits(engine, ids)).toBe('0111');
    });

    it('счётчик Джонсона: 10 → 11 → 01 → 00', () => {
      const { engine } = simulate(johnsonCounter(ff), registry());
      const trace = Array.from({ length: 5 }, () => (pulse(engine), bits(engine, ['F0', 'F1'])));
      expect(trace).toEqual(['10', '11', '01', '00', '10']);
    });

    it('перекос такта через комбинационный элемент не нарушает захват', () => {
      // Такт F1 проходит через BUFFER: в модели без задержек он приходит в том же расчёте.
      const circuit = new CircuitBuilder()
        .input('D', true)
        .input('C')
        .gate('B', 'BUFFER')
        .add('F0', ff)
        .add('F1', ff)
        .wire('D', 'F0.d')
        .wire('F0.q', 'F1.d')
        .wire('C', 'F0.clk')
        .wire('C', 'B')
        .wire('B', 'F1.clk')
        .build();
      const { engine } = simulate(circuit, registry());
      pulse(engine);
      expect(bits(engine, ['F0', 'F1'])).toBe('10');
      pulse(engine);
      expect(bits(engine, ['F0', 'F1'])).toBe('11');
    });

    it('несколько независимых T-триггеров от одного генератора переключаются одновременно', () => {
      const b = new CircuitBuilder().add('K', 'TEST_CLOCK');
      for (const id of ['F0', 'F1', 'F2']) b.add(id, ff).wire('K', `${id}.clk`).wire(`${id}.qn`, `${id}.d`);
      const { engine } = simulate(b.build(), registry());
      const trace = Array.from({ length: 4 }, () => (engine.tick(), bits(engine, ['F0', 'F1', 'F2'])));
      expect(trace).toEqual(['111', '111', '000', '000']);
    });
  });

  describe('асинхронный счётчик', () => {
    it('3 разряда считают 1…7, 0 по передним фронтам генератора', () => {
      const { engine } = simulate(rippleCounter(ff, 3), registry());
      expect(count(engine, 3)).toBe(0);
      const values: number[] = [];
      for (let i = 0; i < 8; i++) {
        engine.tick(); // передний фронт
        values.push(count(engine, 3));
        expectFixpoint(engine);
        engine.tick(); // задний фронт
      }
      expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 0]);
    });
  });

  describe('нет фантомных фронтов', () => {
    it('при включении: такт, равный Q̄ = 1 другого триггера, не срабатывает', () => {
      // F1.clk = Q̄0 = 1 сразу после включения, F1.d = 1: фронта не было — Q1 = 0.
      const circuit = new CircuitBuilder()
        .input('D', true)
        .add('F0', ff)
        .add('F1', ff)
        .wire('F0.qn', 'F1.clk')
        .wire('D', 'F1.d')
        .build();
      for (const variant of [circuit, reversed(circuit)]) {
        const { engine } = simulate(variant, registry());
        expect([read(engine, 'F0.q'), read(engine, 'F0.qn'), read(engine, 'F1.q')]).toEqual([0, 1, 0]);
      }
    });

    it('после reset(): выходы как при включении, без срабатывания', () => {
      const { engine } = simulate(rippleCounter(ff, 3), registry());
      for (let i = 0; i < 5; i++) engine.tick();
      expect(count(engine, 3)).not.toBe(0);
      engine.reset();
      engine.settle();
      expect(engine.time).toBe(0);
      expect(count(engine, 3)).toBe(0);
      expect(['F0', 'F1', 'F2'].map((id) => read(engine, `${id}.qn`))).toEqual([1, 1, 1]);
      // Счёт после сброса начинается заново.
      engine.tick();
      expect(count(engine, 3)).toBe(1);
    });

    it('триггер, добавленный при высоком такте, не срабатывает', () => {
      const reg = registry();
      const before = new CircuitBuilder().input('D', true).input('C', true).add('F0', ff).wire('D', 'F0.d').wire('C', 'F0.clk');
      const { engine } = simulate(before.build(), reg);
      // F0 добавлен при C = 1: фронта не было.
      expect(read(engine, 'F0.q')).toBe(0);

      const after = before.add('F1', ff).wire('D', 'F1.d').wire('C', 'F1.clk').build();
      const next = new SimulationEngine(compileCircuit(after, reg), { initialState: engine.exportState() });
      next.settle();
      expect([read(next, 'F0.q'), read(next, 'F1.q'), read(next, 'F1.qn')]).toEqual([0, 0, 1]);

      // Следующий передний фронт срабатывает у обоих.
      setInput(next, 'C', 0);
      setInput(next, 'C', 1);
      expect([read(next, 'F0.q'), read(next, 'F1.q')]).toEqual([1, 1]);
    });
  });

  describe('детерминированность', () => {
    it('результат не зависит от порядка элементов и проводов', () => {
      const traceOf = (circuit: Circuit) => {
        const { engine } = simulate(circuit, registry());
        setInput(engine, 'D', 1);
        return Array.from({ length: 4 }, () => (pulse(engine), bits(engine, ['F0', 'F1', 'F2'])));
      };
      const circuit = shiftRegister(ff, 3);
      const [d, c, f0, f1, f2] = circuit.components;
      const shuffled: Circuit = { components: [f1!, d!, f2!, f0!, c!], wires: [...circuit.wires].reverse() };
      expect(traceOf(circuit)).toEqual(['100', '110', '111', '111']);
      expect(traceOf(reversed(circuit))).toEqual(traceOf(circuit));
      expect(traceOf(shuffled)).toEqual(traceOf(circuit));
    });

    it('счётчик Джонсона в обратном порядке элементов даёт ту же последовательность', () => {
      const trace = (circuit: Circuit) => {
        const { engine } = simulate(circuit, registry());
        return Array.from({ length: 4 }, () => (pulse(engine), bits(engine, ['F0', 'F1'])));
      };
      expect(trace(reversed(johnsonCounter(ff)))).toEqual(trace(johnsonCounter(ff)));
    });
  });

  describe('перенос состояния', () => {
    it('содержимое регистра сохраняется при перекомпиляции соседней части схемы', () => {
      const reg = registry();
      const circuit = shiftRegister(ff, 3);
      const { engine } = simulate(circuit, reg);
      setInput(engine, 'D', 1);
      pulse(engine);
      setInput(engine, 'D', 0);
      pulse(engine);
      expect(bits(engine, ['F0', 'F1', 'F2'])).toBe('010');

      const gate = { id: 'G', type: 'AND', position: { x: 0, y: 0 }, props: {} };
      const edited = { ...circuit, components: [...circuit.components, gate] };
      const next = new SimulationEngine(compileCircuit(edited, reg), { initialState: engine.exportState() });
      next.settle();
      expect(bits(next, ['F0', 'F1', 'F2'])).toBe('010');
      pulse(next);
      expect(bits(next, ['F0', 'F1', 'F2'])).toBe('001');
    });
  });
});

describe('элементы реестра в схемах', () => {
  it('синхронный 3-разрядный счётчик на T-триггерах: T0 = 1, T1 = Q0, T2 = Q0·Q1', () => {
    const circuit = new CircuitBuilder()
      .input('ONE', true)
      .input('C')
      .add('F0', 'T_FLIP_FLOP')
      .add('F1', 'T_FLIP_FLOP')
      .add('F2', 'T_FLIP_FLOP')
      .gate('A', 'AND')
      .wire('ONE', 'F0.t')
      .wire('F0.q', 'F1.t')
      .wire('F0.q', 'A.in0')
      .wire('F1.q', 'A.in1')
      .wire('A', 'F2.t')
      .wire('C', 'F0.clk')
      .wire('C', 'F1.clk')
      .wire('C', 'F2.clk')
      .build();
    for (const variant of [circuit, reversed(circuit)]) {
      const { engine } = simulate(variant, registry());
      const values = Array.from({ length: 9 }, () => (pulse(engine), count(engine, 3)));
      expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 1]);
    }
  });

  it('JK с J = K = 1 — делитель частоты на 2; J = 1, K = 0 — установка', () => {
    const circuit = new CircuitBuilder()
      .input('J', true)
      .input('K', true)
      .input('C')
      .add('F', 'JK_FLIP_FLOP')
      .wire('J', 'F.j')
      .wire('K', 'F.k')
      .wire('C', 'F.clk')
      .build();
    const { engine } = simulate(circuit, registry());
    const q = () => read(engine, 'F.q');
    const toggles = Array.from({ length: 4 }, () => (pulse(engine), q()));
    expect(toggles).toEqual([1, 0, 1, 0]);
    setInput(engine, 'K', 0);
    pulse(engine);
    pulse(engine);
    expect(q()).toBe(1);
  });

  it('master-slave из двух D-защёлок (E1 = C̄, E2 = C) работает как D-триггер по переднему фронту', () => {
    const circuit = new CircuitBuilder()
      .input('D')
      .input('C')
      .gate('N', 'NOT')
      .add('M', 'D_LATCH')
      .add('S', 'D_LATCH')
      .wire('C', 'N')
      .wire('N', 'M.e')
      .wire('D', 'M.d')
      .wire('M.q', 'S.d')
      .wire('C', 'S.e')
      .build();
    const { engine } = simulate(circuit, registry());
    const q = () => read(engine, 'S.q');
    setInput(engine, 'D', 1);
    expect(q()).toBe(0);
    setInput(engine, 'C', 1); // передний фронт: ведомая защёлка открывается
    expect(q()).toBe(1);
    setInput(engine, 'D', 0); // при C = 1 ведущая закрыта — выход не меняется
    expect(q()).toBe(1);
    setInput(engine, 'C', 0);
    expect(q()).toBe(1);
    setInput(engine, 'C', 1);
    expect(q()).toBe(0);
    expectFixpoint(engine);
  });

  it('D-защёлка с D = Q̄ при E = 1 колеблется — X без зависания', () => {
    const circuit = new CircuitBuilder().input('E').add('L', 'D_LATCH').wire('L.qn', 'L.d').wire('E', 'L.e').build();
    const { engine } = simulate(circuit, registry());
    expect(setInput(engine, 'E', 1).status).toBe('oscillation');
    expect([read(engine, 'L.q'), read(engine, 'L.qn')]).toEqual(['X', 'X']);
    expectFixpoint(engine);
  });
});

describe('нет фантомных фронтов от DECODER и CONSTANT', () => {
  // Y0 DECODER с неподключёнными входами и CONSTANT 1 равны 1 уже в первом расчёте после включения.
  // Первое вычисление такта у триггера только запоминает уровень — фронта нет.

  it('Y0 DECODER (входы не подключены) → CLK: при включении и после reset() Q = 0', () => {
    const circuit = new CircuitBuilder()
      .add('DEC', 'DECODER', { codeBits: 2 })
      .add('K', 'CONSTANT', { level: true })
      .add('F', 'D_FLIP_FLOP')
      .wire('DEC.y0', 'F.clk')
      .wire('K', 'F.d')
      .build();
    for (const variant of [circuit, reversed(circuit)]) {
      const { engine } = simulate(variant, registry());
      expect([read(engine, 'DEC.y0'), read(engine, 'F.q'), read(engine, 'F.qn')]).toEqual([1, 0, 1]);
      engine.reset();
      engine.settle();
      expect([read(engine, 'DEC.y0'), read(engine, 'F.q')]).toEqual([1, 0]);
    }
  });

  it('настоящий фронт на Y0 срабатывает: A0 1 → 0 переводит Y0 0 → 1, Q = D', () => {
    const circuit = new CircuitBuilder()
      .input('A0')
      .add('DEC', 'DECODER', { codeBits: 2 })
      .add('K', 'CONSTANT', { level: true })
      .add('F', 'D_FLIP_FLOP')
      .wire('A0', 'DEC.a0')
      .wire('DEC.y0', 'F.clk')
      .wire('K', 'F.d')
      .build();
    const { engine } = simulate(circuit, registry());
    expect(read(engine, 'F.q')).toBe(0);
    setInput(engine, 'A0', 1);
    expect([read(engine, 'DEC.y0'), read(engine, 'F.q')]).toEqual([0, 0]);
    setInput(engine, 'A0', 0);
    expect([read(engine, 'DEC.y0'), read(engine, 'F.q')]).toEqual([1, 1]);
  });

  it('CONSTANT 1 прямо на CLK: при включении и после reset() Q = 0', () => {
    const circuit = new CircuitBuilder()
      .add('K', 'CONSTANT', { level: true })
      .input('D', true)
      .add('F', 'D_FLIP_FLOP')
      .wire('K', 'F.clk')
      .wire('D', 'F.d')
      .build();
    for (const variant of [circuit, reversed(circuit)]) {
      const { engine } = simulate(variant, registry());
      expect(read(engine, 'F.q')).toBe(0);
      engine.reset();
      engine.settle();
      expect(read(engine, 'F.q')).toBe(0);
    }
  });
});
