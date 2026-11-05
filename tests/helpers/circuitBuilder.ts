import type { Circuit, CircuitComponent, ElementProps, PinRef, Wire } from '@/core/types/circuit';

/** `'A'` → пин по умолчанию; `'A.in1'` → явный пин. */
export function pin(spec: string, defaultPin: string): PinRef {
  const [componentId = '', pinId = defaultPin] = spec.split('.');
  return { componentId, pinId };
}

/** Компактное построение схем в тестах. Провод `wire('A', 'G.in1')`: выход A:out0 → вход G:in1. */
export class CircuitBuilder {
  private readonly components: CircuitComponent[] = [];
  private readonly wires: Wire[] = [];

  add(id: string, type: string, props: ElementProps = {}): this {
    this.components.push({ id, type, position: { x: 0, y: 0 }, props });
    return this;
  }

  input(id: string, value = false): this {
    return this.add(id, 'INPUT', { value });
  }

  output(id: string): this {
    return this.add(id, 'OUTPUT');
  }

  gate(id: string, type: string, inputCount?: number): this {
    return this.add(id, type, inputCount === undefined ? {} : { inputCount });
  }

  wire(from: string, to: string): this {
    this.wires.push({ id: `w${this.wires.length + 1}`, from: pin(from, 'out0'), to: pin(to, 'in0') });
    return this;
  }

  build(): Circuit {
    return { components: [...this.components], wires: [...this.wires] };
  }
}
