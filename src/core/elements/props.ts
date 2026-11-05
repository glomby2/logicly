import type { ElementProps, PropValue } from '../types/circuit';
import type { ElementDefinition } from '../types/element';

/**
 * Приводит свойства к виду, ожидаемому определением элемента:
 * недостающие берутся из `defaultProps`, значения неверного типа и неизвестные ключи
 * отбрасываются, целые числа округляются и ограничиваются диапазоном из `propSchema`.
 */
export function resolveProps(definition: ElementDefinition, raw: ElementProps = {}): ElementProps {
  const result: Record<string, PropValue> = {};

  for (const [key, fallback] of Object.entries(definition.defaultProps)) {
    const value: unknown = raw[key];
    result[key] = typeof value === typeof fallback ? (value as PropValue) : fallback;
  }

  for (const spec of definition.propSchema ?? []) {
    if (spec.kind !== 'integer') continue;
    const value = result[spec.key];
    const fallback = definition.defaultProps[spec.key];
    if (typeof value !== 'number') continue;
    const integer = Number.isFinite(value) ? Math.round(value) : Number(fallback);
    result[spec.key] = Math.min(spec.max, Math.max(spec.min, integer));
  }

  return result;
}
