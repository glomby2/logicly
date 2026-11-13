import { describe, expect, it } from 'vitest';
import { selectIsDirty } from '@/store';
import { createTestApp, inp, out } from '../helpers/stores';

/*
 * Выбор строки таблицы истинности: все INPUT получают комбинацию одним изменением схемы —
 * без записи в историю и с одним пересчётом симуляции.
 */

/** RS-защёлка на NOR. */
function latch() {
  const t = createTestApp();
  const c = () => t.circuit();
  const s = c().addComponent('INPUT', { x: 0, y: 0 }, {}, 'S');
  const r = c().addComponent('INPUT', { x: 0, y: 100 }, {}, 'R');
  const q = c().addComponent('NOR', { x: 100, y: 0 });
  const qn = c().addComponent('NOR', { x: 100, y: 100 });
  c().connect(out(r), inp(q, 0));
  c().connect(out(qn), inp(q, 1));
  c().connect(out(s), inp(qn, 0));
  c().connect(out(q), inp(qn, 1));
  c().markSaved();
  return { ...t, s, r, q, qn };
}

const values = (s: string, sv: boolean, r: string, rv: boolean) => [
  { componentId: s, prop: 'value', value: sv },
  { componentId: r, prop: 'value', value: rv },
];

describe('applyInputCombination', () => {
  it('устанавливает все входы, не пишет историю и не перекомпилирует', () => {
    const t = latch();
    const { history, structureVersion, propsVersion } = t.circuit();
    const compilations = t.simulation().compilations;

    t.app.commands.applyInputCombination(values(t.s, true, t.r, false));
    const props = Object.fromEntries(t.circuit().circuit.components.map((c) => [c.id, c.props.value]));
    expect([props[t.s], props[t.r]]).toEqual([true, false]);
    expect(t.circuit().history).toBe(history);
    expect(t.circuit().structureVersion).toBe(structureVersion);
    expect(t.circuit().propsVersion).toBe(propsVersion + 1);
    expect(t.simulation().compilations).toBe(compilations);
    expect(t.signal(out(t.q))).toBe(1);

    // Undo отменяет последнюю правку схемы, а не выбор строки: положения входов сохраняются.
    t.circuit().undo();
    expect(t.circuit().circuit.components.find((c) => c.id === t.s)!.props.value).toBe(true);
  });

  it('один пересчёт симуляции на всю комбинацию', () => {
    const t = latch();
    let publications = 0;
    const unsubscribe = t.app.simulation.subscribe(() => publications++);
    t.app.commands.applyInputCombination(values(t.s, true, t.r, true));
    unsubscribe();
    expect(publications).toBe(1);
    expect([t.signal(out(t.q)), t.signal(out(t.qn))]).toEqual([0, 0]);
  });

  it('индикатор несохранённых изменений: включается и гаснет при возврате комбинации', () => {
    const t = latch();
    t.app.commands.applyInputCombination(values(t.s, true, t.r, false));
    expect(selectIsDirty(t.circuit())).toBe(true);
    t.app.commands.applyInputCombination(values(t.s, false, t.r, false));
    expect(selectIsDirty(t.circuit())).toBe(false);
  });

  it('та же комбинация ничего не меняет', () => {
    const t = latch();
    const circuit = t.circuit().circuit;
    t.app.commands.applyInputCombination(values(t.s, false, t.r, false));
    expect(t.circuit().circuit).toBe(circuit);
  });
});

describe('updateManyProps', () => {
  it('изменение обычного свойства записывается в историю одним шагом', () => {
    const t = createTestApp();
    const a = t.circuit().addComponent('AND', { x: 0, y: 0 });
    const b = t.circuit().addComponent('OR', { x: 0, y: 0 });
    const past = t.circuit().history.past.length;
    t.circuit().updateManyProps([
      { id: a, patch: { inputCount: 4 } },
      { id: b, patch: { inputCount: 3 } },
      { id: 'missing', patch: { inputCount: 5 } },
    ]);
    expect(t.circuit().circuit.components.map((c) => c.props.inputCount)).toEqual([4, 3]);
    expect(t.circuit().history.past).toHaveLength(past + 1);
    t.circuit().undo();
    expect(t.circuit().circuit.components.map((c) => c.props.inputCount)).toEqual([2, 2]);
  });

  it('пустой список ничего не меняет', () => {
    const t = createTestApp();
    t.circuit().addComponent('INPUT', { x: 0, y: 0 });
    const before = t.circuit();
    t.circuit().updateManyProps([]);
    expect(t.circuit()).toBe(before);
  });

  it('повтор id: действует последнее значение', () => {
    const t = createTestApp();
    const a = t.circuit().addComponent('INPUT', { x: 0, y: 0 });
    const propsVersion = t.circuit().propsVersion;
    t.circuit().updateManyProps([
      { id: a, patch: { value: false } },
      { id: a, patch: { value: true } },
    ]);
    expect(t.circuit().circuit.components[0]!.props.value).toBe(true);
    expect(t.circuit().propsVersion).toBe(propsVersion + 1);
  });

  it('повтор id, вернувший исходное значение, — не изменение и не шаг истории', () => {
    const t = createTestApp();
    const a = t.circuit().addComponent('INPUT', { x: 0, y: 0 });
    const g = t.circuit().addComponent('AND', { x: 0, y: 100 });
    const before = t.circuit();
    t.circuit().updateManyProps([
      { id: a, patch: { value: true } },
      { id: g, patch: { inputCount: 4 } },
      { id: a, patch: { value: false } },
      { id: g, patch: { inputCount: 2 } },
    ]);
    expect(t.circuit()).toBe(before);
  });

  it('смешанное изменение (интерактивное и обычное) записывается в историю', () => {
    const t = createTestApp();
    const a = t.circuit().addComponent('INPUT', { x: 0, y: 0 });
    const g = t.circuit().addComponent('AND', { x: 0, y: 0 });
    const past = t.circuit().history.past.length;
    t.circuit().updateManyProps([
      { id: a, patch: { value: true } },
      { id: g, patch: { inputCount: 3 } },
    ]);
    expect(t.circuit().history.past).toHaveLength(past + 1);
  });
});
