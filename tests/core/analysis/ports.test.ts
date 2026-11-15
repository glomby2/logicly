import { describe, expect, it } from 'vitest';
import { findPorts } from '@/core/analysis';
import { createDefaultRegistry, ElementRegistry, INPUT, OUTPUT } from '@/core/elements';
import type { Circuit, CircuitComponent } from '@/core/types/circuit';
import type { ElementDefinition } from '@/core/types/element';

const registry = createDefaultRegistry();

const at = (id: string, type: string, x: number, y: number, label?: string): CircuitComponent => ({
  id,
  type,
  position: { x, y },
  props: {},
  ...(label ? { label } : {}),
});

const circuit = (...components: CircuitComponent[]): Circuit => ({ components, wires: [] });

describe('findPorts', () => {
  it('входы и выходы — по роли из реестра; вентили не участвуют', () => {
    const ports = findPorts(circuit(at('a', 'INPUT', 0, 0, 'A'), at('g', 'AND', 0, 0), at('y', 'OUTPUT', 0, 0, 'Y')), registry);
    expect(ports.inputs.map((p) => [p.componentId, p.prop])).toEqual([['a', 'value']]);
    expect(ports.outputs.map((p) => p.componentId)).toEqual(['y']);
  });

  it('роль определяется полем port, а не типом: элемент другого типа с ролью тоже вход', () => {
    const custom = new ElementRegistry([
      INPUT,
      OUTPUT,
      { ...INPUT, type: 'SWITCH', label: 'SWITCH' } as ElementDefinition,
      { ...OUTPUT, type: 'LAMP', label: 'LAMP', port: undefined } as ElementDefinition,
    ]);
    const ports = findPorts(circuit(at('s', 'SWITCH', 0, 0, 'S'), at('l', 'LAMP', 0, 0)), custom);
    expect(ports.inputs.map((p) => p.componentId)).toEqual(['s']);
    expect(ports.outputs).toEqual([]);
  });

  it('сортировка: по подписи в естественном порядке, затем без подписи по Y и X, затем по id', () => {
    const ports = findPorts(
      circuit(
        at('n2', 'INPUT', 50, 200),
        at('x10', 'INPUT', 0, 0, 'X10'),
        at('n1', 'INPUT', 90, 100),
        at('x2', 'INPUT', 0, 500, 'X2'),
        at('a', 'INPUT', 0, 300, 'A'),
        at('n0', 'INPUT', 10, 200),
        at('m', 'INPUT', 10, 200),
      ),
      registry,
    );
    expect(ports.inputs.map((p) => p.componentId)).toEqual(['a', 'x2', 'x10', 'n1', 'm', 'n0', 'n2']);
  });

  it('одинаковые подписи упорядочиваются по Y и попадают в duplicateLabels', () => {
    const ports = findPorts(
      circuit(at('b', 'INPUT', 0, 100, 'X1'), at('a', 'INPUT', 0, 50, 'X1'), at('y', 'OUTPUT', 0, 0, 'Y1'), at('z', 'OUTPUT', 0, 0, 'Q')),
      registry,
    );
    expect(ports.inputs.map((p) => p.componentId)).toEqual(['a', 'b']);
    expect(ports.duplicateLabels).toEqual(['X1']);
  });

  it('совпадение подписи входа и выхода — тоже повтор', () => {
    const ports = findPorts(circuit(at('a', 'INPUT', 0, 0, 'S'), at('y', 'OUTPUT', 0, 0, 'S')), registry);
    expect(ports.duplicateLabels).toEqual(['S']);
  });

  it('неизвестные типы пропускаются', () => {
    expect(findPorts(circuit(at('m', 'UNKNOWN_ELEMENT', 0, 0)), registry)).toEqual({ inputs: [], outputs: [], duplicateLabels: [] });
  });
});
