import { resolveProps } from '../elements/props';
import type { ElementRegistry } from '../elements/registry';
import type { Circuit, ComponentId, PinRef } from '../types/circuit';
import type { ElementDefinition, PinSpec } from '../types/element';
import { analyzeGraph } from './graph';
import { netIdOf, type CompileDiagnostic, type CompiledComponent, type NetId, type Netlist } from './netlist';

interface MutableComponent {
  index: number;
  id: ComponentId;
  type: string;
  definition: ElementDefinition;
  props: CompiledComponent['props'];
  inputPins: readonly PinSpec[];
  outputPins: readonly PinSpec[];
  inputNets: (number | null)[];
  outputNets: number[];
  rank: number;
}

/**
 * Компилирует схему в netlist. Некорректные элементы и провода пропускаются
 * и попадают в `diagnostics`, поэтому компиляция не падает на повреждённых данных.
 */
export function compileCircuit(circuit: Circuit, registry: ElementRegistry): Netlist {
  const diagnostics: CompileDiagnostic[] = [];
  const components: MutableComponent[] = [];
  const componentIndex = new Map<ComponentId, number>();
  const netIds: NetId[] = [];
  const netIndex = new Map<NetId, number>();

  for (const component of circuit.components) {
    if (componentIndex.has(component.id)) {
      diagnostics.push({ kind: 'duplicate-component', componentId: component.id });
      continue;
    }
    const definition = registry.get(component.type);
    if (!definition) {
      diagnostics.push({ kind: 'unknown-element', componentId: component.id, type: component.type });
      continue;
    }

    const props = resolveProps(definition, component.props);
    const { inputs, outputs } = definition.pins(props);
    const outputNets = outputs.map((pin) => {
      const id = netIdOf({ componentId: component.id, pinId: pin.id });
      netIndex.set(id, netIds.length);
      netIds.push(id);
      return netIds.length - 1;
    });

    componentIndex.set(component.id, components.length);
    components.push({
      index: components.length,
      id: component.id,
      type: component.type,
      definition,
      props,
      inputPins: inputs,
      outputPins: outputs,
      inputNets: inputs.map(() => null),
      outputNets,
      rank: 0,
    });
  }

  const findInput = (ref: PinRef) => {
    const index = componentIndex.get(ref.componentId);
    const component = index === undefined ? undefined : components[index];
    const pinIndex = component?.inputPins.findIndex((pin) => pin.id === ref.pinId) ?? -1;
    return component && pinIndex >= 0 ? { component, pinIndex } : undefined;
  };

  for (const wire of circuit.wires) {
    const source = netIndex.get(netIdOf(wire.from));
    const target = findInput(wire.to);
    if (source === undefined || !target) {
      diagnostics.push({ kind: 'invalid-wire', wireId: wire.id });
      continue;
    }
    if (target.component.inputNets[target.pinIndex] !== null) {
      diagnostics.push({ kind: 'multiple-drivers', wireId: wire.id });
      continue;
    }
    target.component.inputNets[target.pinIndex] = source;
  }

  const netReaders: number[][] = netIds.map(() => []);
  for (const component of components) {
    for (const net of new Set(component.inputNets)) {
      if (net !== null) netReaders[net]!.push(component.index);
    }
  }

  const successors = components.map((c) => [...new Set(c.outputNets.flatMap((net) => netReaders[net]!))]);
  const { rank, inCycle } = analyzeGraph(successors);
  for (const component of components) component.rank = rank[component.index]!;

  return {
    components,
    componentIndex,
    netIds,
    netIndex,
    netReaders,
    feedbackComponents: new Set(components.filter((c) => inCycle[c.index]).map((c) => c.id)),
    diagnostics,
  };
}
