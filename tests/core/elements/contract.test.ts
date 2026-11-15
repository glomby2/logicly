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

/** Варианты свойств: по умолчанию и каждое допустимое значение каждого целого свойства. */
function propVariants(definition: ElementDefinition): ElementProps[] {
  const variants: ElementProps[] = [resolveProps(definition)];
  for (const spec of definition.propSchema ?? []) {
    if (spec.kind !== 'integer') continue;
    for (let value = spec.min; value <= spec.max; value++) {
      variants.push(resolveProps(definition, { [spec.key]: value }));
    }
  }
  return variants;
}

/** До такого числа входов монотонность дополнительно проверяется перебором всех пар наборов (9ⁿ). */
const PAIRWISE_LIMIT = 4;

/** Набор с i-м входом, заменённым на X. */
const withUnknown = (values: readonly Signal[], i: number): Signal[] => values.map((v, j) => (j === i ? 'X' : v));

type Run = (values: readonly Signal[]) => readonly Signal[];

/** Первое нарушение «каждый выход для `approx` равен X или выходу для `exact`»; `null` — нарушений нет. */
function refinementViolation(approx: readonly Signal[], exact: readonly Signal[], message: string): string | null {
  const i = approx.findIndex((value, k) => value !== 'X' && value !== exact[k]);
  return i < 0 ? null : `${message}, выход ${i}: ${approx[i]} вместо X или ${exact[i]}`;
}

/*
 * Монотонность по X: если набор `vague` получен из `precise` заменой части входов на X,
 * каждый выход для `vague` равен X или выходу для `precise`.
 *
 * Достаточно проверить замену одного входа: любой `vague` получается из `precise`
 * цепочкой одиночных замен, а отношение «равен X или совпадает» транзитивно.
 * Это 3ⁿ·n вычислений вместо 9ⁿ, поэтому проверяются все значения свойств
 * (MUX 8:1 — 11 входов). Для малых n дополнительно перебираются все пары наборов.
 */
function monotonicityViolation(run: Run, inputCount: number): string | null {
  const all = ternaryCombinations(inputCount);
  for (const precise of all) {
    const result = run(precise);
    for (let i = 0; i < precise.length; i++) {
      if (precise[i] === 'X') continue;
      const violation = refinementViolation(run(withUnknown(precise, i)), result, `${precise} → вход ${i} = X`);
      if (violation) return violation;
    }
    if (inputCount > PAIRWISE_LIMIT) continue;
    for (const vague of all) {
      if (!refines(precise, vague)) continue;
      const violation = refinementViolation(run(vague), result, `${precise} → ${vague}`);
      if (violation) return violation;
    }
  }
  return null;
}

describe('проверка монотонности', () => {
  it('находит нарушение, которое проявляется только при двух X, и без перебора пар', () => {
    // 1 ровно при двух X, иначе 0: из 000000 через X00000 в XX0000 значение 0 меняется на 1.
    const broken: Run = (values) => [values.filter((v) => v === 'X').length === 2 ? 1 : 0];
    expect(PAIRWISE_LIMIT).toBeLessThan(6);
    expect(monotonicityViolation(broken, 6)).toMatch(/выход 0: 1 вместо X или 0/);
  });

  it('не находит нарушений у монотонной функции', () => {
    const and: Run = (values) => [values.includes(0) ? 0 : values.includes('X') ? 'X' : 1];
    expect(monotonicityViolation(and, 6)).toBeNull();
    expect(monotonicityViolation(and, 3)).toBeNull();
  });
});

/** Предел числа состояний: у элементов реестра их единицы или десятки (CLOCK — до 32). */
const MAX_REACHABLE_STATES = 1000;

/**
 * Все состояния, достижимые из начального и из `unknownState` любыми последовательностями
 * вычислений (на всех троичных наборах входов) и тиков. Триггеру нужно не меньше двух
 * вычислений, чтобы получить Q = 1 (запомнить CLK = 0, затем фронт), поэтому строится
 * полное замыкание, а не один шаг.
 */
function reachableStates(definition: ElementDefinition, props: ElementProps): unknown[] {
  const roots = [definition.initialState?.(props), definition.unknownState?.(props)].filter((s) => s !== undefined);
  if (roots.length === 0) return [undefined];
  const inputSets = ternaryCombinations(definition.pins(props).inputs.length);
  const seen = new Map<string, unknown>();
  const queue: unknown[] = [...roots];
  while (queue.length > 0) {
    const state = queue.pop();
    const key = JSON.stringify(state);
    if (seen.has(key)) continue;
    seen.set(key, state);
    if (seen.size > MAX_REACHABLE_STATES) throw new Error(`${definition.type}: слишком много состояний`);
    for (const inputs of inputSets) {
      const next = definition.evaluate({ inputs, props, state }).state;
      if (next !== undefined) queue.push(next);
    }
    if (definition.onTick) queue.push(definition.onTick({ props, state, time: 1 }));
  }
  return [...seen.values()];
}

describe('достижимые состояния', () => {
  it('у триггеров и защёлки замыкание содержит Q = 0, 1 и X; у CLOCK — оба уровня', () => {
    for (const type of ['D_LATCH', 'D_FLIP_FLOP', 'T_FLIP_FLOP', 'JK_FLIP_FLOP']) {
      const definition = BUILTIN_ELEMENTS.find((d) => d.type === type)!;
      const qs = new Set(reachableStates(definition, {}).map((s) => (s as { q: unknown }).q));
      expect([...qs].sort(), type).toEqual([0, 1, 'X'].sort());
    }
    const clock = BUILTIN_ELEMENTS.find((d) => d.type === 'CLOCK')!;
    const levels = new Set(reachableStates(clock, { halfPeriod: 3 }).map((s) => (s as { level: unknown }).level));
    expect([...levels].sort()).toEqual([0, 1]);
  });
});

// Тестовые элементы с состоянием проверяются тем же контрактом, что и встроенные CLOCK и триггеры.
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

      for (const state of reachableStates(definition, props)) {
        const run: Run = (values) => definition.evaluate({ inputs: values, props, state }).outputs;
        for (const values of ternaryCombinations(inputs.length)) {
          const result = run(values);
          if (result.length !== outputs.length) expect(result, `${values}`).toHaveLength(outputs.length);
          const again = run(values);
          if (again.some((v, i) => v !== result[i])) expect(again, `${values}`).toEqual(result);
        }
        expect(monotonicityViolation(run, inputs.length), JSON.stringify(props)).toBeNull();
      }
    }
  });

  it('unknownState не определённее любого достижимого состояния', () => {
    if (!definition.unknownState) return;
    expect(definition.initialState, 'unknownState имеет смысл только у элемента с состоянием').toBeDefined();
    for (const props of propVariants(definition)) {
      const unknown = definition.unknownState(props);
      const states = reachableStates(definition, props);
      for (const inputs of ternaryCombinations(definition.pins(props).inputs.length)) {
        const vague = definition.evaluate({ inputs, props, state: unknown }).outputs;
        for (const state of states) {
          const exact = definition.evaluate({ inputs, props, state }).outputs;
          const violation = refinementViolation(vague, exact, `входы ${inputs}, состояние ${JSON.stringify(state)}`);
          if (violation) expect.fail(violation);
        }
      }
    }
  });

  it('роль внешнего вывода (port) согласована с пинами и evaluate', () => {
    const { port } = definition;
    if (!port) return;
    const props = resolveProps(definition);
    if (port.kind === 'output') {
      expect(definition.pins(props).inputs.length).toBeGreaterThan(0);
      return;
    }
    // Вход: логическое свойство задаёт единственный выход, входных пинов нет.
    expect(typeof definition.defaultProps[port.prop]).toBe('boolean');
    expect(definition.pins(props).inputs).toHaveLength(0);
    expect(definition.pins(props).outputs).toHaveLength(1);
    for (const value of [false, true]) {
      const state = definition.initialState?.(props);
      const outputs = definition.evaluate({ inputs: [], props: { ...props, [port.prop]: value }, state }).outputs;
      expect(outputs).toEqual([value ? 1 : 0]);
    }
  });

  it('вычисление идемпотентно: повтор с новым состоянием и теми же входами даёт те же выходы', () => {
    for (const props of propVariants(definition)) {
      const all = ternaryCombinations(definition.pins(props).inputs.length);
      for (const state of reachableStates(definition, props)) {
        for (const inputs of all) {
          const first = definition.evaluate({ inputs, props, state });
          const second = definition.evaluate({ inputs, props, state: first.state ?? state });
          // expect — только при расхождении: на 3ⁿ наборах сам вызов expect дороже вычисления.
          if (second.outputs.some((v, i) => v !== first.outputs[i]) || second.outputs.length !== first.outputs.length) {
            expect(second.outputs, `${inputs}`).toEqual(first.outputs);
          }
        }
      }
    }
  });
});
