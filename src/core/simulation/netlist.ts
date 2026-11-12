import type { ComponentId, ElementProps, PinRef, WireId } from '../types/circuit';
import type { ElementDefinition, PinSpec } from '../types/element';

/** Сеть = выходной пин: `componentId:pinId`. */
export type NetId = string;

export function netIdOf(ref: PinRef): NetId {
  return `${ref.componentId}:${ref.pinId}`;
}

/** Обратное к `netIdOf`: ключ `componentId:pinId` → ссылка на пин. Id пина не содержит `:`. */
export function pinRefFromKey(key: string): PinRef | null {
  const separator = key.lastIndexOf(':');
  if (separator <= 0 || separator === key.length - 1) return null;
  return { componentId: key.slice(0, separator), pinId: key.slice(separator + 1) };
}

export interface CompiledComponent {
  readonly index: number;
  readonly id: ComponentId;
  readonly type: string;
  readonly definition: ElementDefinition;
  readonly props: ElementProps;
  readonly inputPins: readonly PinSpec[];
  readonly outputPins: readonly PinSpec[];
  /** Сеть, питающая каждый вход; `null` — вход не подключён (читается как 0). */
  readonly inputNets: readonly (number | null)[];
  readonly outputNets: readonly number[];
  /** Позиция в топологическом порядке (обратные связи разорваны по DFS). */
  readonly rank: number;
}

export type CompileDiagnostic =
  | { readonly kind: 'unknown-element'; readonly componentId: ComponentId; readonly type: string }
  | { readonly kind: 'duplicate-component'; readonly componentId: ComponentId }
  | { readonly kind: 'invalid-wire'; readonly wireId: WireId }
  | { readonly kind: 'multiple-drivers'; readonly wireId: WireId };

/** Скомпилированная схема: строковые id заменены индексами. Позиции элементов не учитываются. */
export interface Netlist {
  readonly components: readonly CompiledComponent[];
  readonly componentIndex: ReadonlyMap<ComponentId, number>;
  readonly netIds: readonly NetId[];
  readonly netIndex: ReadonlyMap<NetId, number>;
  /** Индексы элементов, читающих каждую сеть. */
  readonly netReaders: readonly (readonly number[])[];
  /** Элементы, входящие в петли обратной связи. */
  readonly feedbackComponents: ReadonlySet<ComponentId>;
  readonly diagnostics: readonly CompileDiagnostic[];
}

/** Неподключённые входы — для визуального выделения в интерфейсе. */
export function findFloatingInputs(netlist: Netlist): PinRef[] {
  return netlist.components.flatMap((component) =>
    component.inputPins
      .filter((_, i) => component.inputNets[i] === null)
      .map((pin) => ({ componentId: component.id, pinId: pin.id })),
  );
}
