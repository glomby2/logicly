import { findComponent, getComponentPins, isPinConnected } from '@/core/circuit';
import type { ElementRegistry } from '@/core/elements';
import { pinRefFromKey } from '@/core/simulation';
import type { Circuit, CircuitComponent, PinRef, Wire } from '@/core/types/circuit';
import type { PinDirection, PropSpec } from '@/core/types/element';
import type { Selection } from '@/store';

/*
 * Модель инспектора: что показывать для текущего выделения. Чистая функция без React —
 * компоненты только отображают результат. Сигналы сюда не входят: их компоненты читают
 * из simulationStore сами, чтобы модель не пересчитывалась на каждый пересчёт схемы.
 */

export interface PinRow {
  readonly id: string;
  readonly direction: PinDirection;
  /** Номер среди входов или среди выходов. */
  readonly index: number;
  readonly label?: string;
  readonly connected: boolean;
}

export interface PinEndpoint {
  readonly componentId: string;
  readonly componentName: string;
  readonly pinId: string;
  readonly direction: PinDirection;
  readonly index: number;
  readonly pinLabel?: string;
}

export interface InspectorIssue {
  readonly kind: 'floating' | 'unknown';
  readonly endpoint: PinEndpoint;
}

export interface TypeCount {
  readonly type: string;
  readonly title: string;
  readonly count: number;
}

export type InspectorModel =
  | {
      readonly kind: 'component';
      readonly component: CircuitComponent;
      readonly name: string;
      readonly title: string;
      readonly description: string;
      readonly props: readonly PropSpec[];
      /** Элемент переключается кликом (есть логическое свойство `value`). */
      readonly toggle: boolean;
      readonly pins: readonly PinRow[];
    }
  | { readonly kind: 'wire'; readonly wire: Wire; readonly from: PinEndpoint; readonly to: PinEndpoint }
  | {
      readonly kind: 'multiple';
      readonly components: number;
      readonly wires: number;
      readonly byType: readonly TypeCount[];
    }
  | {
      readonly kind: 'circuit';
      readonly components: number;
      readonly wires: number;
      readonly issues: readonly InspectorIssue[];
    };

export interface InspectorInput {
  readonly circuit: Circuit;
  readonly selection: Selection;
  readonly registry: ElementRegistry;
  /** Ключи неподключённых входов (`componentId:pinId`). */
  readonly floatingInputs: ReadonlySet<string>;
  /** Сети со значением X. */
  readonly unknownNets: readonly string[];
}

const titleOf = (registry: ElementRegistry, type: string) => registry.get(type)?.label ?? type;

/**
 * Имя элемента для интерфейса: подпись, а без неё — название типа и порядковый номер
 * среди элементов того же типа («AND #2»). Номер не нужен, если элемент своего типа один.
 */
export function componentName(circuit: Circuit, registry: ElementRegistry, component: CircuitComponent): string {
  if (component.label) return component.label;
  const sameType = circuit.components.filter((c) => c.type === component.type);
  const title = titleOf(registry, component.type);
  return sameType.length > 1 ? `${title} #${sameType.indexOf(component) + 1}` : title;
}

function pinRows(circuit: Circuit, registry: ElementRegistry, component: CircuitComponent): PinRow[] {
  const pins = getComponentPins(registry, component);
  if (!pins) return [];
  const rows = (specs: typeof pins.inputs, direction: PinDirection) =>
    specs.map(
      (spec, index): PinRow => ({
        id: spec.id,
        direction,
        index,
        connected: isPinConnected(circuit, { componentId: component.id, pinId: spec.id }),
        ...(spec.label ? { label: spec.label } : {}),
      }),
    );
  return [...rows(pins.inputs, 'input'), ...rows(pins.outputs, 'output')];
}

export function describeEndpoint(circuit: Circuit, registry: ElementRegistry, ref: PinRef): PinEndpoint | null {
  const component = findComponent(circuit, ref.componentId);
  if (!component) return null;
  const pin = pinRows(circuit, registry, component).find((row) => row.id === ref.pinId);
  if (!pin) return null;
  return {
    componentId: component.id,
    componentName: componentName(circuit, registry, component),
    pinId: pin.id,
    direction: pin.direction,
    index: pin.index,
    ...(pin.label ? { pinLabel: pin.label } : {}),
  };
}

function collectIssues(input: InspectorInput): InspectorIssue[] {
  const { circuit, registry } = input;
  const order = new Map(circuit.components.map((c, i) => [c.id, i]));
  const issues = (keys: Iterable<string>, kind: InspectorIssue['kind']) =>
    [...keys].flatMap((key): InspectorIssue[] => {
      const ref = pinRefFromKey(key);
      const endpoint = ref && describeEndpoint(circuit, registry, ref);
      return endpoint ? [{ kind, endpoint }] : [];
    });
  const position = (issue: InspectorIssue) => order.get(issue.endpoint.componentId) ?? 0;
  return [...issues(input.unknownNets, 'unknown'), ...issues(input.floatingInputs, 'floating')].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === 'unknown' ? -1 : 1) ||
      position(a) - position(b) ||
      a.endpoint.index - b.endpoint.index,
  );
}

export function buildInspectorModel(input: InspectorInput): InspectorModel {
  const { circuit, selection, registry } = input;
  const components = selection.components.flatMap((id) => findComponent(circuit, id) ?? []);
  const wires = selection.wires.flatMap((id) => circuit.wires.find((w) => w.id === id) ?? []);

  if (components.length === 1 && wires.length === 0) {
    const component = components[0]!;
    const definition = registry.get(component.type);
    return {
      kind: 'component',
      component,
      name: componentName(circuit, registry, component),
      title: titleOf(registry, component.type),
      description: definition?.description ?? '',
      props: definition?.propSchema ?? [],
      toggle: typeof component.props.value === 'boolean',
      pins: pinRows(circuit, registry, component),
    };
  }

  if (components.length === 0 && wires.length === 1) {
    const wire = wires[0]!;
    const from = describeEndpoint(circuit, registry, wire.from);
    const to = describeEndpoint(circuit, registry, wire.to);
    if (from && to) return { kind: 'wire', wire, from, to };
  }

  if (components.length + wires.length > 1) {
    const counts = new Map<string, number>();
    for (const c of components) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    return {
      kind: 'multiple',
      components: components.length,
      wires: wires.length,
      byType: [...counts].map(([type, count]) => ({ type, title: titleOf(registry, type), count })),
    };
  }

  return {
    kind: 'circuit',
    components: circuit.components.length,
    wires: circuit.wires.length,
    issues: collectIssues(input),
  };
}
