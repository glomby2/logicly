import { resolveProps } from '../elements/props';
import type { ElementRegistry } from '../elements/registry';
import type { Circuit, CircuitComponent, ComponentId, ElementProps, WireId } from '../types/circuit';
import { findPin } from './pins';

/** Добавляет элемент; свойства приводятся к виду, ожидаемому его определением. */
export function addComponent(circuit: Circuit, registry: ElementRegistry, component: CircuitComponent): Circuit {
  if (circuit.components.some((c) => c.id === component.id)) {
    throw new Error(`Элемент "${component.id}" уже существует`);
  }
  const props = resolveProps(registry.require(component.type), component.props);
  return { ...circuit, components: [...circuit.components, { ...component, props }] };
}

/** Удаляет элементы вместе со всеми подключёнными к ним проводами. */
export function removeComponents(circuit: Circuit, ids: Iterable<ComponentId>): Circuit {
  const removed = new Set(ids);
  return {
    components: circuit.components.filter((c) => !removed.has(c.id)),
    wires: circuit.wires.filter((w) => !removed.has(w.from.componentId) && !removed.has(w.to.componentId)),
  };
}

export function removeWires(circuit: Circuit, ids: Iterable<WireId>): Circuit {
  const removed = new Set(ids);
  return { ...circuit, wires: circuit.wires.filter((w) => !removed.has(w.id)) };
}

/**
 * Обновляет свойства элемента. Если при этом исчезли пины (например, уменьшилось
 * число входов), подключённые к ним провода удаляются.
 */
export function updateComponentProps(
  circuit: Circuit,
  registry: ElementRegistry,
  id: ComponentId,
  patch: ElementProps,
): Circuit {
  const updated = {
    ...circuit,
    components: circuit.components.map((c) => {
      if (c.id !== id) return c;
      return { ...c, props: resolveProps(registry.require(c.type), { ...c.props, ...patch }) };
    }),
  };
  return pruneInvalidWires(updated, registry);
}

/**
 * Переносит значения интерактивных свойств (`interactiveProps`) из `source` в `target`
 * для элементов с совпадающими id и типом. Используется при undo/redo: отмена правки
 * схемы не должна откатывать положения переключателей.
 */
export function carryInteractiveProps(target: Circuit, source: Circuit, registry: ElementRegistry): Circuit {
  const sourceById = new Map(source.components.map((c) => [c.id, c]));
  let changed = false;
  const components = target.components.map((component) => {
    const current = sourceById.get(component.id);
    const keys = registry.get(component.type)?.interactiveProps ?? [];
    if (!current || current.type !== component.type || keys.length === 0) return component;
    const differing = keys.filter((key) => key in current.props && current.props[key] !== component.props[key]);
    if (differing.length === 0) return component;
    changed = true;
    const props = { ...component.props };
    for (const key of differing) props[key] = current.props[key]!;
    return { ...component, props };
  });
  return changed ? { ...target, components } : target;
}

/**
 * Удаляет провода, нарушающие правила соединений: ссылающиеся на несуществующие пины,
 * направленные не от выхода к входу, а также лишние источники одного входа
 * (сохраняется первый провод).
 */
export function pruneInvalidWires(circuit: Circuit, registry: ElementRegistry): Circuit {
  const drivenInputs = new Set<string>();
  const wires = circuit.wires.filter((wire) => {
    const from = findPin(registry, circuit, wire.from);
    const to = findPin(registry, circuit, wire.to);
    if (from?.direction !== 'output' || to?.direction !== 'input') return false;

    const key = `${wire.to.componentId}:${wire.to.pinId}`;
    if (drivenInputs.has(key)) return false;
    drivenInputs.add(key);
    return true;
  });
  return wires.length === circuit.wires.length ? circuit : { ...circuit, wires };
}
