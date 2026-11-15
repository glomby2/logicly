import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PinRef } from '@/core/types/circuit';
import { createTestApp, out } from '../helpers/stores';

/*
 * CLOCK и триггеры в хранилищах, мосте и контроллере Start / Pause / Step / Reset:
 * шаги времени, отсутствие искусственных фронтов при повторном Start и добавлении
 * триггера, сброс, перенос состояния при правке схемы и Undo, сохранение и загрузка.
 */

const pin = (componentId: string, pinId: string): PinRef => ({ componentId, pinId });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Генератор → T-триггер (T = 1) и 3-разрядный сдвиговый регистр с входом D. */
function setup() {
  const t = createTestApp();
  const c = () => t.circuit();
  const clock = c().addComponent('CLOCK', { x: 0, y: 0 });
  const one = c().addComponent('INPUT', { x: 0, y: 100 }, { value: true });
  const d = c().addComponent('INPUT', { x: 0, y: 200 });
  const toggle = c().addComponent('T_FLIP_FLOP', { x: 200, y: 0 });
  c().connect(out(clock), pin(toggle, 'clk'));
  c().connect(out(one), pin(toggle, 't'));
  const stages = [0, 1, 2].map((i) => c().addComponent('D_FLIP_FLOP', { x: 200 + i * 120, y: 200 }));
  stages.forEach((id, i) => {
    c().connect(i === 0 ? out(d) : pin(stages[i - 1]!, 'q'), pin(id, 'd'));
    c().connect(out(clock), pin(id, 'clk'));
  });
  const controller = t.app.simulationController;
  t.simulation().setFrequency(2); // 500 мс на шаг
  const q = (id: string) => t.signal(pin(id, 'q'));
  const register = () => stages.map((id) => q(id)).join('');
  return { ...t, c, clock, d, toggle, stages, controller, q, register };
}

describe('CLOCK и контроллер', () => {
  it('CLOCK включает Start / Step; шаг меняет уровень, T-триггер переключается по переднему фронту', () => {
    const t = setup();
    expect(t.simulation().hasTimeElements).toBe(true);
    const trace: string[] = [];
    for (let i = 0; i < 4; i++) {
      t.controller.step();
      trace.push(`${t.signal(out(t.clock))}${t.q(t.toggle)}`);
    }
    expect(trace).toEqual(['11', '01', '10', '00']);
    expect(t.simulation().time).toBe(4);
  });

  it('сдвиговый регистр от CLOCK: один разряд за период', () => {
    const t = setup();
    t.app.commands.toggleInput(t.d);
    t.controller.step(); // передний фронт
    expect(t.register()).toBe('100');
    t.controller.step();
    t.app.commands.toggleInput(t.d);
    t.controller.step();
    expect(t.register()).toBe('010');
    t.controller.step();
    t.controller.step();
    expect(t.register()).toBe('001');
  });

  it('повторный Start после Pause не создаёт искусственных фронтов', () => {
    const t = setup();
    t.controller.start();
    vi.advanceTimersByTime(500 * 3); // фронты на шагах 1 и 3
    t.controller.pause();
    expect(t.q(t.toggle)).toBe(0);
    const time = t.simulation().time;

    // Pause / Start несколько раз без хода времени — состояние не меняется.
    for (let i = 0; i < 3; i++) {
      t.controller.start();
      t.controller.pause();
    }
    expect(t.simulation().time).toBe(time);
    expect(t.q(t.toggle)).toBe(0);

    t.controller.start();
    vi.advanceTimersByTime(500 * 2); // шаг 4 — задний фронт, шаг 5 — передний
    t.controller.pause();
    expect(t.simulation().time).toBe(5);
    expect(t.q(t.toggle)).toBe(1);
  });

  it('Reset: время 0, генератор 0, триггеры Q = 0 и Q̄ = 1, счёт начинается заново', () => {
    const t = setup();
    t.app.commands.toggleInput(t.d);
    for (let i = 0; i < 5; i++) t.controller.step();
    expect(t.register()).not.toBe('000');
    t.controller.reset();
    expect(t.simulation().time).toBe(0);
    expect(t.signal(out(t.clock))).toBe(0);
    expect(t.register()).toBe('000');
    expect([t.toggle, ...t.stages].map((id) => t.signal(pin(id, 'qn')))).toEqual([1, 1, 1, 1]);
    t.controller.step();
    expect([t.q(t.toggle), t.register()]).toEqual([1, '100']);
  });
});

describe('перенос состояния при правке схемы', () => {
  it('добавление элемента при работающем такте ставит на паузу и сохраняет состояние; Undo тоже', () => {
    const t = setup();
    t.app.commands.toggleInput(t.d);
    t.controller.start();
    vi.advanceTimersByTime(500 * 3);
    expect(t.register()).toBe('110');
    const compilations = t.simulation().compilations;

    t.c().addComponent('AND', { x: 600, y: 600 });
    expect(t.simulation().running).toBe(false);
    expect(t.simulation().compilations).toBe(compilations + 1);
    expect(t.register()).toBe('110');
    expect(t.q(t.toggle)).toBe(0);

    t.c().undo();
    expect(t.register()).toBe('110');
    t.c().redo();
    expect(t.register()).toBe('110');
  });

  it('триггер, появившийся вместе с проводами при высоком такте (Undo удаления), не срабатывает', () => {
    const t = setup();
    const last = t.stages[2]!;
    t.c().remove({ components: [last] });
    t.app.commands.toggleInput(t.d);
    t.controller.step();
    t.controller.step();
    t.controller.step();
    expect(t.signal(out(t.clock))).toBe(1);
    expect(t.q(t.stages[1]!)).toBe(1);

    // Триггер возвращается со своими проводами при CLK = 1 и D = Q1 = 1: фронта не было.
    t.c().undo();
    expect([t.q(last), t.signal(pin(last, 'qn'))]).toEqual([0, 1]);
    t.controller.step();
    t.controller.step();
    expect(t.q(last)).toBe(1);
  });

  it('подключение провода с уровнем 1 к неподключённому тактовому входу — это фронт 0 → 1', () => {
    // Неподключённый вход равен 0, поэтому подключение высокого такта — настоящий переход.
    const t = setup();
    t.app.commands.toggleInput(t.d);
    t.controller.step();
    const late = t.c().addComponent('D_FLIP_FLOP', { x: 800, y: 0 });
    t.c().connect(out(t.d), pin(late, 'd'));
    expect(t.q(late)).toBe(0);
    t.c().connect(out(t.clock), pin(late, 'clk'));
    expect(t.q(late)).toBe(1);
  });

  it('полупериод CLOCK — шаг истории без перекомпиляции', () => {
    const t = setup();
    const compilations = t.simulation().compilations;
    const past = t.c().history.past.length;
    t.c().updateProps(t.clock, { halfPeriod: 2 });
    expect(t.c().history.past).toHaveLength(past + 1);
    expect(t.simulation().compilations).toBe(compilations);
    const levels = Array.from({ length: 6 }, () => (t.controller.step(), t.signal(out(t.clock))));
    expect(levels).toEqual([0, 1, 1, 0, 0, 1]);
  });
});

describe('сохранение и загрузка', () => {
  it('файл не содержит состояния: после открытия — состояние включения', () => {
    const t = setup();
    t.app.commands.toggleInput(t.d);
    for (let i = 0; i < 3; i++) t.controller.step();
    expect(t.register()).not.toBe('000');

    let text = '';
    expect(t.app.commands.saveDocument((_, content) => (text = content), 'схема').ok).toBe(true);
    expect(text).not.toMatch(/"(q|level|phase|clk)"\s*:/);

    const other = createTestApp();
    expect(other.app.commands.openDocument('схема.lsim', text).status).toBe('loaded');
    expect(other.simulation().time).toBe(0);
    expect(t.stages.map((id) => other.signal(pin(id, 'q'))).join('')).toBe('000');
    expect(other.circuit().circuit).toEqual(t.c().circuit);
  });
});
