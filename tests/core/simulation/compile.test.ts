import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { compileCircuit, findFloatingInputs } from '@/core/simulation';
import { CircuitBuilder } from '../../helpers/circuitBuilder';
import { halfAdder, norLatch } from '../../helpers/circuits';

const registry = createDefaultRegistry();

describe('compileCircuit', () => {
  it('создаёт сеть для каждого выходного пина', () => {
    const netlist = compileCircuit(halfAdder().build(), registry);
    expect(netlist.netIds).toEqual(['A:out0', 'B:out0', 'X:out0', 'C:out0']);
    expect(netlist.diagnostics).toEqual([]);
  });

  it('связывает входы с сетями источников; неподключённые входы — null', () => {
    const netlist = compileCircuit(new CircuitBuilder().input('A').gate('G', 'AND').wire('A', 'G.in1').build(), registry);
    const gate = netlist.components[netlist.componentIndex.get('G')!]!;
    expect(gate.inputNets).toEqual([null, netlist.netIndex.get('A:out0')]);
    expect(findFloatingInputs(netlist)).toEqual([{ componentId: 'G', pinId: 'in0' }]);
  });

  it('учитывает число входов из свойств', () => {
    const netlist = compileCircuit(new CircuitBuilder().gate('G', 'OR', 5).build(), registry);
    expect(netlist.components[0]!.inputPins.map((p) => p.id)).toEqual(['in0', 'in1', 'in2', 'in3', 'in4']);
  });

  it('читатель сети учитывается один раз, даже если она подключена к нескольким его входам', () => {
    const netlist = compileCircuit(
      new CircuitBuilder().input('A').gate('G', 'AND').wire('A', 'G.in0').wire('A', 'G.in1').build(),
      registry,
    );
    expect(netlist.netReaders[netlist.netIndex.get('A:out0')!]).toEqual([netlist.componentIndex.get('G')]);
  });

  it('пропускает некорректные данные и сообщает о них в diagnostics', () => {
    const circuit = new CircuitBuilder()
      .input('A')
      .input('B')
      .gate('G', 'AND')
      .add('U', 'MYSTERY')
      .add('A', 'OR')
      .wire('A', 'G.in0')
      .wire('B', 'G.in0')
      .wire('A', 'G.in9')
      .wire('U', 'G.in1')
      .build();
    const netlist = compileCircuit(circuit, registry);
    expect(netlist.components.map((c) => c.id)).toEqual(['A', 'B', 'G']);
    expect(netlist.diagnostics).toEqual([
      { kind: 'unknown-element', componentId: 'U', type: 'MYSTERY' },
      { kind: 'duplicate-component', componentId: 'A' },
      { kind: 'multiple-drivers', wireId: 'w2' },
      { kind: 'invalid-wire', wireId: 'w3' },
      { kind: 'invalid-wire', wireId: 'w4' },
    ]);
  });

  it('находит элементы в петлях обратной связи', () => {
    const latch = compileCircuit(norLatch().output('L').wire('Q', 'L').build(), registry);
    expect([...latch.feedbackComponents].sort()).toEqual(['Q', 'QN']);
    expect(compileCircuit(halfAdder().build(), registry).feedbackComponents.size).toBe(0);
  });

  it('ранги схемы без петель соблюдают направление проводов', () => {
    const netlist = compileCircuit(halfAdder().build(), registry);
    const rank = (id: string) => netlist.components[netlist.componentIndex.get(id)!]!.rank;
    expect(rank('A')).toBeLessThan(rank('X'));
    expect(rank('B')).toBeLessThan(rank('C'));
    expect(rank('X')).toBeLessThan(rank('SUM'));
    expect(rank('C')).toBeLessThan(rank('CARRY'));
  });
});
