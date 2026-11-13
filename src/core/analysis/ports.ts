import type { ElementRegistry } from '../elements/registry';
import type { Circuit, ComponentId, Point } from '../types/circuit';

/** Внешний вход схемы: элемент с ролью `port.kind === 'input'`. */
export interface InputPort {
  readonly componentId: ComponentId;
  readonly type: string;
  readonly label?: string;
  readonly position: Point;
  /** Логическое свойство, которое задаёт значение входа. */
  readonly prop: string;
}

/** Внешний выход схемы: элемент с ролью `port.kind === 'output'`. */
export interface OutputPort {
  readonly componentId: ComponentId;
  readonly type: string;
  readonly label?: string;
  readonly position: Point;
}

export interface CircuitPorts {
  readonly inputs: readonly InputPort[];
  readonly outputs: readonly OutputPort[];
  /** Подписи, которые встречаются у нескольких входов или выходов. */
  readonly duplicateLabels: readonly string[];
}

const collator = new Intl.Collator('ru', { numeric: true });

/**
 * Порядок столбцов: сначала элементы с подписью — по подписи (естественный порядок:
 * X2 раньше X10), затем без подписи; при равенстве — по Y, по X и по id.
 */
export function comparePorts(a: OutputPort, b: OutputPort): number {
  if (!!a.label !== !!b.label) return a.label ? -1 : 1;
  const byLabel = a.label && b.label ? collator.compare(a.label, b.label) : 0;
  return (
    byLabel ||
    a.position.y - b.position.y ||
    a.position.x - b.position.x ||
    (a.componentId < b.componentId ? -1 : a.componentId > b.componentId ? 1 : 0)
  );
}

/** Входы и выходы схемы по ролям из реестра (без проверок типа элемента). */
export function findPorts(circuit: Circuit, registry: ElementRegistry): CircuitPorts {
  const inputs: InputPort[] = [];
  const outputs: OutputPort[] = [];
  for (const component of circuit.components) {
    const port = registry.get(component.type)?.port;
    if (!port) continue;
    const base = {
      componentId: component.id,
      type: component.type,
      position: component.position,
      ...(component.label ? { label: component.label } : {}),
    };
    if (port.kind === 'input') inputs.push({ ...base, prop: port.prop });
    else outputs.push(base);
  }
  inputs.sort(comparePorts);
  outputs.sort(comparePorts);

  const counts = new Map<string, number>();
  for (const { label } of [...inputs, ...outputs]) if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  const duplicateLabels = [...counts].filter(([, count]) => count > 1).map(([label]) => label);

  return { inputs, outputs, duplicateLabels };
}
