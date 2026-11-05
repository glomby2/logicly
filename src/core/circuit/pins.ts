import { resolveProps } from '../elements/props';
import type { ElementRegistry } from '../elements/registry';
import type { Circuit, CircuitComponent, PinRef } from '../types/circuit';
import type { ElementPins, PinDirection, PinSpec } from '../types/element';

export interface ResolvedPin {
  readonly direction: PinDirection;
  readonly index: number;
  readonly spec: PinSpec;
}

export function samePin(a: PinRef, b: PinRef): boolean {
  return a.componentId === b.componentId && a.pinId === b.pinId;
}

export function findComponent(circuit: Circuit, componentId: string): CircuitComponent | undefined {
  return circuit.components.find((component) => component.id === componentId);
}

/** Пины экземпляра элемента; `undefined`, если тип не зарегистрирован. */
export function getComponentPins(registry: ElementRegistry, component: CircuitComponent): ElementPins | undefined {
  const definition = registry.get(component.type);
  return definition?.pins(resolveProps(definition, component.props));
}

export function findPin(registry: ElementRegistry, circuit: Circuit, ref: PinRef): ResolvedPin | undefined {
  const component = findComponent(circuit, ref.componentId);
  const pins = component && getComponentPins(registry, component);
  if (!pins) return undefined;

  const inputIndex = pins.inputs.findIndex((pin) => pin.id === ref.pinId);
  if (inputIndex >= 0) return { direction: 'input', index: inputIndex, spec: pins.inputs[inputIndex]! };

  const outputIndex = pins.outputs.findIndex((pin) => pin.id === ref.pinId);
  if (outputIndex >= 0) return { direction: 'output', index: outputIndex, spec: pins.outputs[outputIndex]! };

  return undefined;
}

/** Совпадают ли наборы пинов (одинаковые id в том же порядке). */
export function samePinLayout(a: ElementPins, b: ElementPins): boolean {
  const sameIds = (x: readonly PinSpec[], y: readonly PinSpec[]) =>
    x.length === y.length && x.every((pin, i) => pin.id === y[i]!.id);
  return sameIds(a.inputs, b.inputs) && sameIds(a.outputs, b.outputs);
}
