import type { ElementRegistry } from '../elements/registry';
import type { Circuit, CircuitComponent, ComponentId, Point, Wire } from '../types/circuit';
import { addComponent, pruneInvalidWires } from './editing';

/** Часть схемы: элементы и провода между ними. Используется для копирования и вставки. */
export interface CircuitFragment {
  readonly components: readonly CircuitComponent[];
  readonly wires: readonly Wire[];
}

/** Выбранные элементы и провода, оба конца которых лежат внутри выделения. */
export function extractFragment(circuit: Circuit, componentIds: Iterable<ComponentId>): CircuitFragment {
  const ids = new Set(componentIds);
  return {
    components: circuit.components.filter((c) => ids.has(c.id)),
    wires: circuit.wires.filter((w) => ids.has(w.from.componentId) && ids.has(w.to.componentId)),
  };
}

/** Копия фрагмента с новыми id и смещёнными позициями; провода переподключаются к новым id. */
export function instantiateFragment(
  fragment: CircuitFragment,
  createId: (prefix: string) => string,
  offset: Point,
): CircuitFragment {
  const ids = new Map(fragment.components.map((c) => [c.id, createId(c.type.toLowerCase())]));
  const remap = (componentId: ComponentId) => ids.get(componentId) ?? componentId;
  return {
    components: fragment.components.map((c) => ({
      ...c,
      id: remap(c.id),
      position: { x: c.position.x + offset.x, y: c.position.y + offset.y },
    })),
    wires: fragment.wires.map((w) => ({
      id: createId('w'),
      from: { ...w.from, componentId: remap(w.from.componentId) },
      to: { ...w.to, componentId: remap(w.to.componentId) },
    })),
  };
}

/** Добавляет фрагмент в схему с проверкой элементов и правил соединений. */
export function insertFragment(circuit: Circuit, registry: ElementRegistry, fragment: CircuitFragment): Circuit {
  let next = circuit;
  for (const component of fragment.components) next = addComponent(next, registry, component);
  if (fragment.wires.length > 0) next = pruneInvalidWires({ ...next, wires: [...next.wires, ...fragment.wires] }, registry);
  return next;
}
