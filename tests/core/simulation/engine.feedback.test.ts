import { describe, expect, it } from 'vitest';
import { addComponent } from '@/core/circuit';
import { createDefaultRegistry } from '@/core/elements';
import { compileCircuit, SimulationEngine } from '@/core/simulation';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import {
  enabledRingOscillator,
  halfAdder,
  inverterRing,
  muxDLatch,
  nandDLatch,
  nandLatch,
  norLatch,
} from '../../helpers/circuits';
import { expectFixpoint, read, setInput, simulate } from '../../helpers/simulation';

const registry = createDefaultRegistry();
const latchState = (engine: SimulationEngine) => [read(engine, 'Q'), read(engine, 'QN')];

describe('RS-защёлка на NOR', () => {
  it('при включении устойчива и находится в одном из допустимых состояний', () => {
    const { engine, result } = simulate(norLatch().build());
    expect(result.status).toBe('stable');
    expect(result.unknownNets).toEqual([]);
    const [q, qn] = latchState(engine);
    expect(q).not.toBe(qn);
    expectFixpoint(engine);
  });

  it('установка, хранение, сброс, хранение', () => {
    const { engine } = simulate(norLatch().build());

    expect(setInput(engine, 'S', 1).status).toBe('stable');
    expect(latchState(engine)).toEqual([1, 0]);
    setInput(engine, 'S', 0);
    expect(latchState(engine)).toEqual([1, 0]);

    setInput(engine, 'R', 1);
    expect(latchState(engine)).toEqual([0, 1]);
    setInput(engine, 'R', 0);
    expect(latchState(engine)).toEqual([0, 1]);

    // Повторная установка после сброса.
    setInput(engine, 'S', 1);
    setInput(engine, 'S', 0);
    expect(latchState(engine)).toEqual([1, 0]);
    expectFixpoint(engine);
  });

  it('запрещённая комбинация S = R = 1 даёт Q = Q̄ = 0 без X', () => {
    const { engine } = simulate(norLatch().build());
    setInput(engine, 'S', 1);
    const result = setInput(engine, 'R', 1);
    expect(result.status).toBe('stable');
    expect(latchState(engine)).toEqual([0, 0]);
    // Снятие одного из сигналов — однозначный переход.
    setInput(engine, 'R', 0);
    expect(latchState(engine)).toEqual([1, 0]);
  });
});

describe('RS-защёлка на NAND (активный уровень 0)', () => {
  it('установка, хранение, сброс, хранение', () => {
    const { engine } = simulate(nandLatch().build());
    // Оба входа неактивны.
    setInput(engine, 'SN', 1);
    setInput(engine, 'RN', 1);
    const [q, qn] = latchState(engine);
    expect(q).not.toBe(qn);

    setInput(engine, 'SN', 0);
    expect(latchState(engine)).toEqual([1, 0]);
    setInput(engine, 'SN', 1);
    expect(latchState(engine)).toEqual([1, 0]);

    setInput(engine, 'RN', 0);
    expect(latchState(engine)).toEqual([0, 1]);
    setInput(engine, 'RN', 1);
    expect(latchState(engine)).toEqual([0, 1]);
    expectFixpoint(engine);
  });

  it('S̄ = R̄ = 0 даёт Q = Q̄ = 1', () => {
    const { engine, result } = simulate(nandLatch().build());
    expect(result.status).toBe('stable');
    expect(latchState(engine)).toEqual([1, 1]);
  });
});

describe('D-защёлки', () => {
  it('на мультиплексоре без согласующего терма (статический риск): расчёт завершается в неподвижной точке', () => {
    // Исход в реальном железе зависит от задержек; модель без задержек даёт детерминированный результат.
    const { engine } = simulate(muxDLatch({ consensus: false }).build());
    setInput(engine, 'E', 1);
    setInput(engine, 'D', 1);
    expect(read(engine, 'Q')).toBe(1);
    expect(setInput(engine, 'E', 0).status).toBe('stable');
    expectFixpoint(engine);
  });

  it.each([
    ['на NAND', () => nandDLatch()],
    ['на мультиплексоре с согласующим термом', () => muxDLatch()],
  ])('%s: прозрачна при E = 1 и хранит значение при E = 0', (_, build) => {
    const { engine } = simulate(build().build());

    setInput(engine, 'E', 1);
    setInput(engine, 'D', 1);
    expect(read(engine, 'Q')).toBe(1);
    setInput(engine, 'D', 0);
    expect(read(engine, 'Q')).toBe(0);
    setInput(engine, 'D', 1);

    expect(setInput(engine, 'E', 0).status).toBe('stable');
    expect(read(engine, 'Q')).toBe(1);
    setInput(engine, 'D', 0);
    expect(read(engine, 'Q')).toBe(1);

    setInput(engine, 'E', 1);
    expect(read(engine, 'Q')).toBe(0);
    setInput(engine, 'E', 0);
    setInput(engine, 'D', 1);
    expect(read(engine, 'Q')).toBe(0);
    expectFixpoint(engine);
  });
});

describe('нестабильные схемы', () => {
  it('NOT, замкнутый сам на себя, даёт X', () => {
    const { engine, result } = simulate(new CircuitBuilder().gate('N', 'NOT').wire('N', 'N').build());
    expect(result.status).toBe('oscillation');
    expect(read(engine, 'N')).toBe('X');
    expect(result.unknownNets).toEqual(['N:out0']);
    expectFixpoint(engine);
  });

  it.each([3, 5, 7])('кольцо из %i инверторов даёт X на всех сетях', (n) => {
    const { engine, result } = simulate(inverterRing(n).build());
    expect(result.status).toBe('oscillation');
    expect(result.unknownNets).toHaveLength(n);
    expectFixpoint(engine);
  });

  it.each([2, 4])('кольцо из %i инверторов устойчиво', (n) => {
    const { engine, result } = simulate(inverterRing(n).build());
    expect(result.status).toBe('stable');
    expect(result.unknownNets).toEqual([]);
    for (let i = 0; i < n; i++) expect(read(engine, `N${i}`)).not.toBe(read(engine, `N${(i + 1) % n}`));
  });

  it('генератор с разрешением: X только пока EN = 1', () => {
    const { engine, result } = simulate(enabledRingOscillator().build());
    expect(result.status).toBe('stable');
    expect(read(engine, 'G')).toBe(1);

    const started = setInput(engine, 'EN', 1);
    expect(started.status).toBe('oscillation');
    expect([...started.unknownNets].sort()).toEqual(['G:out0', 'N0:out0', 'N1:out0']);
    expectFixpoint(engine);

    // X — устойчивое значение: дальнейшие расчёты не зацикливаются.
    expect(engine.settle().unknownNets).toHaveLength(3);

    const stopped = setInput(engine, 'EN', 0);
    expect(stopped.status).toBe('stable');
    expect(stopped.unknownNets).toEqual([]);
    expect([read(engine, 'G'), read(engine, 'N0'), read(engine, 'N1')]).toEqual([1, 0, 1]);
  });

  it('X распространяется дальше, только если не перекрыт доминирующим значением', () => {
    const circuit = enabledRingOscillator()
      .input('M')
      .gate('AND', 'AND')
      .gate('OR', 'OR')
      .output('L')
      .wire('N1', 'AND.in0')
      .wire('M', 'AND.in1')
      .wire('N1', 'OR.in0')
      .wire('M', 'OR.in1')
      .wire('N1', 'L')
      .build();
    const { engine } = simulate(circuit);
    setInput(engine, 'EN', 1);
    expect([read(engine, 'AND'), read(engine, 'OR'), read(engine, 'L')]).toEqual([0, 'X', 'X']);
    setInput(engine, 'M', 1);
    expect([read(engine, 'AND'), read(engine, 'OR')]).toEqual(['X', 1]);
  });

  it('генератор не затрагивает независимую защёлку в той же схеме', () => {
    const circuit = enabledRingOscillator(norLatch()).build();
    const { engine } = simulate(circuit);
    setInput(engine, 'S', 1);
    setInput(engine, 'S', 0);

    expect(setInput(engine, 'EN', 1).status).toBe('oscillation');
    expect(latchState(engine)).toEqual([1, 0]);

    // Защёлка продолжает работать, пока генератор колеблется.
    setInput(engine, 'R', 1);
    setInput(engine, 'R', 0);
    expect(latchState(engine)).toEqual([0, 1]);
    expect(read(engine, 'G')).toBe('X');
  });

  it('в схеме без петель порог колебаний не достигается даже при пороге 1', () => {
    const { engine, result } = simulate(halfAdder().build(), registry, { oscillationThreshold: 1 });
    expect(result.status).toBe('stable');
    expect(setInput(engine, 'A', 1).status).toBe('stable');
    expect([read(engine, 'SUM'), read(engine, 'CARRY')]).toEqual([1, 0]);
  });

  it('при низком пороге колебание обнаруживается раньше, результат тот же', () => {
    for (const oscillationThreshold of [1, 2, 8]) {
      const { engine } = simulate(enabledRingOscillator().build(), registry, { oscillationThreshold });
      const result = setInput(engine, 'EN', 1);
      expect(result.status).toBe('oscillation');
      expect(result.unknownNets).toHaveLength(3);
      expectFixpoint(engine);
    }
  });
});

/**
 * Один вход T одновременно разрешает кольцевой генератор и устанавливает NOR-защёлку (S = T).
 * Порядок добавления элементов меняет их ранги и, значит, порядок обработки в очереди.
 */
function sharedTriggerCircuit(latchFirst: boolean, triggered = false) {
  const b = new CircuitBuilder().input('T', triggered).input('R');
  const addLatch = () =>
    b.gate('Q', 'NOR').gate('QN', 'NOR').wire('R', 'Q.in0').wire('QN', 'Q.in1').wire('T', 'QN.in0').wire('Q', 'QN.in1');
  const addOscillator = () =>
    b.gate('G', 'NAND').gate('N0', 'NOT').gate('N1', 'NOT').wire('T', 'G.in0').wire('N1', 'G.in1').wire('G', 'N0').wire('N0', 'N1');
  if (latchFirst) {
    addLatch();
    addOscillator();
  } else {
    addOscillator();
    addLatch();
  }
  return b.build();
}

describe('генератор, запущенный тем же событием, не портит защёлку', () => {
  it.each([true, false])('переключение общего входа (защёлка добавлена первой: %s)', (latchFirst) => {
    const { engine } = simulate(sharedTriggerCircuit(latchFirst));
    expect(latchState(engine)).toEqual([0, 1]);

    const result = setInput(engine, 'T', 1);
    expect(result.status).toBe('oscillation');
    expect(latchState(engine)).toEqual([1, 0]);
    expect([...result.unknownNets].sort()).toEqual(['G:out0', 'N0:out0', 'N1:out0']);
    expectFixpoint(engine);

    // После остановки генератора защёлка хранит значение.
    const stopped = setInput(engine, 'T', 0);
    expect(stopped.status).toBe('stable');
    expect(stopped.unknownNets).toEqual([]);
    expect(latchState(engine)).toEqual([1, 0]);
  });

  it.each([true, false])('включение схемы с уже разрешённым генератором (защёлка первой: %s)', (latchFirst) => {
    const { engine, result } = simulate(sharedTriggerCircuit(latchFirst, true));
    expect(result.status).toBe('oscillation');
    expect(latchState(engine)).toEqual([1, 0]);
    expect([...result.unknownNets].sort()).toEqual(['G:out0', 'N0:out0', 'N1:out0']);
    expectFixpoint(engine);
  });
});

describe('включение и reset при работающем генераторе', () => {
  /** Защёлка в режиме хранения (S = R = 0) и независимый генератор, разрешённый с самого начала. */
  function holdingLatchWithOscillator(latchFirst: boolean) {
    const b = new CircuitBuilder();
    const latch = () => b.input('S').input('R').gate('Q', 'NOR').gate('QN', 'NOR')
      .wire('R', 'Q.in0').wire('QN', 'Q.in1').wire('S', 'QN.in0').wire('Q', 'QN.in1');
    const oscillator = () => b.input('EN', true).gate('G', 'NAND').gate('N0', 'NOT').gate('N1', 'NOT')
      .wire('EN', 'G.in0').wire('N1', 'G.in1').wire('G', 'N0').wire('N0', 'N1');
    if (latchFirst) {
      latch();
      oscillator();
    } else {
      oscillator();
      latch();
    }
    return b.build();
  }

  it.each([true, false])('защёлка получает определённое состояние (защёлка первой: %s)', (latchFirst) => {
    const { engine, result } = simulate(holdingLatchWithOscillator(latchFirst));
    expect(result.status).toBe('oscillation');
    expect([...result.unknownNets].sort()).toEqual(['G:out0', 'N0:out0', 'N1:out0']);
    const [q, qn] = latchState(engine);
    expect(q).not.toBe('X');
    expect(q).not.toBe(qn);
    expectFixpoint(engine);
  });

  it.each([true, false])('то же после reset() (защёлка первой: %s)', (latchFirst) => {
    const { engine } = simulate(holdingLatchWithOscillator(latchFirst));
    setInput(engine, 'S', 1);
    setInput(engine, 'S', 0);
    engine.reset();
    const result = engine.settle();
    expect([...result.unknownNets].sort()).toEqual(['G:out0', 'N0:out0', 'N1:out0']);
    expect(read(engine, 'Q')).not.toBe(read(engine, 'QN'));
  });
});

describe('сохранение состояния при перекомпиляции', () => {
  it('защёлка сохраняет значение после изменения структуры схемы', () => {
    const circuit = norLatch().build();
    const { engine } = simulate(circuit);
    setInput(engine, 'R', 1);
    setInput(engine, 'R', 0);
    setInput(engine, 'S', 1);
    setInput(engine, 'S', 0);
    expect(latchState(engine)).toEqual([1, 0]);

    const edited = addComponent(circuit, registry, { id: 'EXTRA', type: 'AND', position: { x: 0, y: 0 }, props: {} });
    const next = new SimulationEngine(compileCircuit(edited, registry), { initialState: engine.exportState() });
    expect(next.settle().status).toBe('stable');
    expect(latchState(next)).toEqual([1, 0]);
  });

  it('без переноса состояния защёлка стартует заново', () => {
    const { engine } = simulate(norLatch().build());
    setInput(engine, 'S', 1);
    setInput(engine, 'S', 0);
    const fresh = simulate(norLatch().build()).engine;
    expect(latchState(engine)).toEqual([1, 0]);
    expect(latchState(fresh)).toEqual([0, 1]);
  });
});
