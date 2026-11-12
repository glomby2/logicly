import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { MAX_FREQUENCY, MIN_FREQUENCY } from '@/store';
import { TEST_CLOCK } from '../helpers/fixtureElements';
import { createTestApp, inp, out } from '../helpers/stores';

/*
 * Контроллер проверяется на тестовом генераторе TEST_CLOCK (onTick, полупериод 1 тик):
 * каждый тик меняет уровень, поэтому время в simulationStore равно числу выполненных шагов.
 */

function setup({ withClock = true } = {}) {
  const registry = createDefaultRegistry();
  registry.register(TEST_CLOCK);
  const t = createTestApp({ registry });
  const clock = withClock ? t.circuit().addComponent('TEST_CLOCK', { x: 0, y: 0 }) : '';
  const controller = t.app.simulationController;
  t.simulation().setFrequency(2); // 500 мс на шаг
  return { ...t, clock, controller };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('simulationController: запуск и пауза', () => {
  it('без элементов времени Start ничего не делает', () => {
    const { controller, simulation } = setup({ withClock: false });
    expect(simulation().hasTimeElements).toBe(false);
    expect(controller.start()).toBe(false);
    expect(simulation().running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Start выполняет шаги с заданной частотой, Pause останавливает', () => {
    const { controller, simulation, signal, clock } = setup();
    expect(simulation().hasTimeElements).toBe(true);
    expect(controller.start()).toBe(true);
    expect(simulation().running).toBe(true);

    vi.advanceTimersByTime(500);
    expect(simulation().time).toBe(1);
    expect(signal(out(clock))).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(simulation().time).toBe(3);

    controller.pause();
    expect(simulation().running).toBe(false);
    expect(controller.isTimerActive()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(simulation().time).toBe(3);
  });

  it('повторный Start не создаёт второй таймер', () => {
    const { controller, simulation } = setup();
    controller.start();
    controller.start();
    controller.start();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(simulation().time).toBe(2);
  });

  it('смена частоты на ходу перезапускает единственный таймер с новым интервалом', () => {
    const { controller, simulation } = setup();
    controller.start();
    vi.advanceTimersByTime(500);
    controller.setFrequency(10);
    expect(simulation().frequency).toBe(10);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(simulation().time).toBe(1 + 10);
  });

  it('смена частоты на паузе таймер не запускает', () => {
    const { controller } = setup();
    controller.setFrequency(5);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('частота ограничена допустимым диапазоном', () => {
    const { controller, simulation } = setup();
    controller.setFrequency(1000);
    expect(simulation().frequency).toBe(MAX_FREQUENCY);
    controller.setFrequency(0);
    expect(simulation().frequency).toBe(MIN_FREQUENCY);
    controller.setFrequency(Number.NaN);
    expect(simulation().frequency).toBeGreaterThanOrEqual(MIN_FREQUENCY);
  });
});

describe('simulationController: Step и Reset', () => {
  it('Step выполняет один шаг; во время работы сначала ставит на паузу', () => {
    const { controller, simulation } = setup();
    controller.step();
    expect(simulation().time).toBe(1);

    controller.start();
    vi.advanceTimersByTime(500);
    controller.step();
    expect(simulation().running).toBe(false);
    expect(simulation().time).toBe(3);
    vi.advanceTimersByTime(2000);
    expect(simulation().time).toBe(3);
  });

  it('Reset останавливает таймер и возвращает состояние включения', () => {
    const { controller, simulation, signal, clock } = setup();
    controller.start();
    vi.advanceTimersByTime(1500);
    controller.reset();
    expect(simulation().running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(simulation().time).toBe(0);
    expect(signal(out(clock))).toBe(0);
  });

  it('Reset доступен и без элементов времени: сбрасывает защёлки', () => {
    const { controller, app, circuit, signal } = setup({ withClock: false });
    // RS-защёлка на NOR, установленная в Q = 1.
    const s = app.commands.placeElement('INPUT', { x: 0, y: 0 });
    const r = app.commands.placeElement('INPUT', { x: 0, y: 0 });
    const q = circuit().addComponent('NOR', { x: 0, y: 0 });
    const qn = circuit().addComponent('NOR', { x: 0, y: 0 });
    circuit().connect(out(r), inp(q, 0));
    circuit().connect(out(qn), inp(q, 1));
    circuit().connect(out(s), inp(qn, 0));
    circuit().connect(out(q), inp(qn, 1));
    const powerUp = signal(out(q));
    app.commands.toggleInput(powerUp === 1 ? r : s);
    app.commands.toggleInput(powerUp === 1 ? r : s);
    expect(signal(out(q))).not.toBe(powerUp);

    controller.reset();
    expect(signal(out(q))).toBe(powerUp);
  });
});

describe('simulationController: автоматическая остановка', () => {
  it('структурное изменение схемы останавливает таймер', () => {
    const { controller, simulation, circuit } = setup();
    controller.start();
    circuit().addComponent('AND', { x: 0, y: 0 });
    expect(simulation().running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('перемещение и переключение INPUT работу не прерывают', () => {
    const { controller, simulation, circuit, app, clock } = setup();
    const a = app.commands.placeElement('INPUT', { x: 0, y: 0 });
    controller.start();
    circuit().moveComponents([{ id: clock, position: { x: 50, y: 50 } }]);
    app.commands.toggleInput(a);
    expect(simulation().running).toBe(true);
    vi.advanceTimersByTime(500);
    expect(simulation().time).toBe(1);
  });

  it('удаление последнего элемента времени останавливает таймер', () => {
    const { controller, simulation, circuit, clock } = setup();
    controller.start();
    circuit().remove({ components: [clock] });
    expect(simulation().hasTimeElements).toBe(false);
    expect(simulation().running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('загрузка документа останавливает таймер', () => {
    const { controller, simulation, circuit } = setup();
    controller.start();
    circuit().loadCircuit({ components: [], wires: [] });
    expect(simulation().running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dispose снимает таймер и подписки', () => {
    const { controller, simulation, circuit, app } = setup();
    controller.start();
    app.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(simulation().running).toBe(false);
    // После dispose контроллер не реагирует на изменения схемы.
    const state = simulation();
    circuit().addComponent('AND', { x: 0, y: 0 });
    expect(simulation()).toBe(state);
  });
});

describe('scheduler', () => {
  it('контроллер использует переданный планировщик', () => {
    const calls: string[] = [];
    const registry = createDefaultRegistry();
    registry.register(TEST_CLOCK);
    const { app, circuit } = createTestApp({
      registry,
      scheduler: {
        setInterval: (_, ms) => (calls.push(`set ${ms}`), 7),
        clearInterval: (handle) => calls.push(`clear ${String(handle)}`),
      },
    });
    circuit().addComponent('TEST_CLOCK', { x: 0, y: 0 });
    app.simulationController.start();
    app.simulationController.pause();
    expect(calls).toEqual(['set 500', 'clear 7']);
  });
});
