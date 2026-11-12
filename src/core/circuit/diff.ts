import type { ElementRegistry } from '../elements/registry';
import type { Circuit, CircuitComponent, ElementProps, Wire } from '../types/circuit';
import { getComponentPins, samePin, samePinLayout } from './pins';

/**
 * Влияние изменения схемы на симуляцию:
 * - `none` — только позиции и подписи; симуляция не затрагивается;
 * - `props` — свойства без смены пинов; достаточно `engine.setProps()`;
 * - `structure` — элементы, провода, порядок или набор пинов; нужна перекомпиляция.
 */
export type CircuitChange = 'none' | 'props' | 'structure';

/** Ключи свойств, значения которых различаются. */
export function changedPropKeys(a: ElementProps, b: ElementProps): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((key) => a[key] !== b[key]);
}

function sameWires(a: readonly Wire[], b: readonly Wire[]): boolean {
  return (
    a.length === b.length &&
    a.every((wire, i) => {
      const other = b[i]!;
      return wire.id === other.id && samePin(wire.from, other.from) && samePin(wire.to, other.to);
    })
  );
}

function samePins(registry: ElementRegistry, a: CircuitComponent, b: CircuitComponent): boolean {
  const pinsA = getComponentPins(registry, a);
  const pinsB = getComponentPins(registry, b);
  if (!pinsA || !pinsB) return pinsA === pinsB;
  return samePinLayout(pinsA, pinsB);
}

function sameComponent(a: CircuitComponent, b: CircuitComponent): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    (a.label ?? '') === (b.label ?? '') &&
    (a.props === b.props || changedPropKeys(a.props, b.props).length === 0)
  );
}

/**
 * Совпадает ли содержимое двух схем — всё, что попадает в файл, с учётом порядка.
 * Сначала сравниваются ссылки: неизменённая схема и снимки истории проверяются мгновенно.
 */
export function circuitsEqual(a: Circuit, b: Circuit): boolean {
  if (a === b) return true;
  if (a.components.length !== b.components.length) return false;
  if (a.wires !== b.wires && !sameWires(a.wires, b.wires)) return false;
  return a.components.every((component, i) => sameComponent(component, b.components[i]!));
}

export function classifyChange(prev: Circuit, next: Circuit, registry: ElementRegistry): CircuitChange {
  if (prev === next) return 'none';
  if (prev.wires !== next.wires && !sameWires(prev.wires, next.wires)) return 'structure';
  if (prev.components.length !== next.components.length) return 'structure';

  let propsChanged = false;
  for (let i = 0; i < prev.components.length; i++) {
    const a = prev.components[i]!;
    const b = next.components[i]!;
    if (a === b) continue;
    if (a.id !== b.id || a.type !== b.type) return 'structure';
    if (a.props === b.props || changedPropKeys(a.props, b.props).length === 0) continue;
    if (!samePins(registry, a, b)) return 'structure';
    propsChanged = true;
  }
  return propsChanged ? 'props' : 'none';
}
