import { describe, expect, it } from 'vitest';
import { BUILTIN_ELEMENTS, resolveProps } from '@/core/elements';
import type { ElementProps } from '@/core/types/circuit';
import type { Signal } from '@/core/logic/signal';
import type { ElementDefinition } from '@/core/types/element';
import { refines, ternaryCombinations } from '../../helpers/combinations';
import { TEST_CLOCK, TEST_DFF } from '../../helpers/fixtureElements';

/*
 * Контракт ElementDefinition, обязательный для любого элемента реестра —
 * в том числе для будущих. Новый элемент автоматически проверяется этими тестами.
 */

/** Варианты свойств: по умолчанию и, для целых свойств, граничные значения. */
function propVariants(definition: ElementDefinition): ElementProps[] {
  const variants: ElementProps[] = [resolveProps(definition)];
  for (const spec of definition.propSchema ?? []) {
    if (spec.kind !== 'integer') continue;
    // Перебор 3^n комбинаций входов: ограничиваем n, чтобы тест оставался быстрым.
    const max = Math.min(spec.max, 4);
    variants.push(resolveProps(definition, { [spec.key]: spec.min }), resolveProps(definition, { [spec.key]: max }));
  }
  return variants;
}

/** Начальное состояние и состояния после одного вычисления и одного тика из него. */
function reachableStates(definition: ElementDefinition, props: ElementProps): unknown[] {
  const initial = definition.initialState?.(props);
  if (initial === undefined) return [undefined];
  const states: unknown[] = [initial];
  for (const inputs of ternaryCombinations(definition.pins(props).inputs.length)) {
    const next = definition.evaluate({ inputs, props, state: initial }).state;
    if (next !== undefined) states.push(next);
  }
  if (definition.onTick) states.push(definition.onTick({ props, state: initial, time: 1 }));
  return states;
}

// Тестовые элементы с состоянием проверяются тем же контрактом, что и будущие CLOCK и триггеры.
const CHECKED_ELEMENTS: readonly ElementDefinition[] = [...BUILTIN_ELEMENTS, TEST_CLOCK, TEST_DFF];

describe.each(CHECKED_ELEMENTS.map((d) => [d.type, d] as const))('контракт элемента %s', (_, definition) => {
  it('имеет непустые type, label и description', () => {
    expect(definition.type).not.toBe('');
    expect(definition.label).not.toBe('');
    expect(definition.description).not.toBe('');
  });

  it('defaultProps проходит resolveProps без изменений', () => {
    expect(resolveProps(definition)).toEqual(definition.defaultProps);
  });

  it('интерактивные свойства объявлены в defaultProps', () => {
    for (const key of definition.interactiveProps ?? []) {
      expect(definition.defaultProps).toHaveProperty(key);
    }
  });

  it('id пинов уникальны', () => {
    for (const props of propVariants(definition)) {
      const { inputs, outputs } = definition.pins(props);
      const ids = [...inputs, ...outputs].map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('число выходов evaluate совпадает с pins().outputs, вычисление детерминировано и монотонно по X', () => {
    for (const props of propVariants(definition)) {
      const { inputs, outputs } = definition.pins(props);
      const all = ternaryCombinations(inputs.length);

      for (const state of reachableStates(definition, props)) {
        const run = (values: readonly Signal[]) => definition.evaluate({ inputs: values, props, state }).outputs;

        for (const precise of all) {
          const result = run(precise);
          expect(result).toHaveLength(outputs.length);
          expect(run(precise)).toEqual(result);

          for (const vague of all) {
            if (!refines(precise, vague)) continue;
            const approx = run(vague);
            approx.forEach((value, i) => {
              expect(value === 'X' || value === result[i], `${precise} → ${vague}, выход ${i}`).toBe(true);
            });
          }
        }
      }
    }
  });

  it('вычисление идемпотентно: повтор с новым состоянием и теми же входами даёт те же выходы', () => {
    for (const props of propVariants(definition)) {
      const all = ternaryCombinations(definition.pins(props).inputs.length);
      for (const state of reachableStates(definition, props)) {
        for (const inputs of all) {
          const first = definition.evaluate({ inputs, props, state });
          const second = definition.evaluate({ inputs, props, state: first.state ?? state });
          expect(second.outputs, `${inputs}`).toEqual(first.outputs);
        }
      }
    }
  });
});
