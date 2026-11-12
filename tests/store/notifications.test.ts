import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { connectionRejection } from '@/editor/connectionRules';
import { ru } from '@/i18n/ru';
import { createUiStore, MAX_NOTIFICATIONS, pushNotification } from '@/store';
import { CircuitBuilder } from '../helpers/circuitBuilder';

describe('pushNotification', () => {
  it('добавляет новое уведомление в конец', () => {
    const queue = pushNotification(pushNotification([], 'a', 'info', 1), 'b', 'warning', 2);
    expect(queue.map((n) => [n.id, n.message, n.tone, n.count])).toEqual([
      [1, 'a', 'info', 1],
      [2, 'b', 'warning', 1],
    ]);
  });

  it('повтор не создаёт дубликат: счётчик и ревизия растут, уведомление переходит в конец', () => {
    let queue = pushNotification([], 'a', 'info', 1);
    queue = pushNotification(queue, 'b', 'info', 2);
    queue = pushNotification(queue, 'a', 'info', 3);
    queue = pushNotification(queue, 'a', 'info', 4);
    expect(queue.map((n) => [n.id, n.message, n.count, n.revision])).toEqual([
      [2, 'b', 1, 0],
      [1, 'a', 3, 2],
    ]);
  });

  it('то же сообщение с другим тоном — отдельное уведомление', () => {
    const queue = pushNotification(pushNotification([], 'a', 'info', 1), 'a', 'warning', 2);
    expect(queue).toHaveLength(2);
  });

  it('очередь ограничена: старые вытесняются', () => {
    let queue = pushNotification([], 'm0', 'info', 0);
    for (let i = 1; i < 10; i++) queue = pushNotification(queue, `m${i}`, 'info', i);
    expect(queue.map((n) => n.message)).toEqual(['m7', 'm8', 'm9']);
    expect(queue).toHaveLength(MAX_NOTIFICATIONS);
  });

  it('частые одинаковые сообщения не вытесняют остальные', () => {
    let queue = pushNotification([], 'важное', 'warning', 1);
    for (let i = 0; i < 50; i++) queue = pushNotification(queue, 'спам', 'info', 100 + i);
    expect(queue.map((n) => n.message)).toEqual(['важное', 'спам']);
    expect(queue[1]!.count).toBe(50);
  });
});

describe('uiStore: уведомления', () => {
  it('notify и dismissNotification', () => {
    const ui = createUiStore();
    ui.getState().notify('a');
    ui.getState().notify('b', 'warning');
    const [a, b] = ui.getState().notifications;
    expect(a).toMatchObject({ message: 'a', tone: 'info' });
    expect(b!.id).not.toBe(a!.id);

    ui.getState().dismissNotification(a!.id);
    expect(ui.getState().notifications.map((n) => n.message)).toEqual(['b']);

    const state = ui.getState();
    ui.getState().dismissNotification(999);
    expect(ui.getState()).toBe(state);
  });
});

describe('connectionRejection', () => {
  const registry = createDefaultRegistry();
  const circuit = new CircuitBuilder().input('A').input('B').gate('G', 'AND').wire('A', 'G.in0').build();
  const pin = (componentId: string, pinId: string) => ({ componentId, pinId });

  it('сообщает причину отказа, а для допустимого соединения — null', () => {
    expect(connectionRejection(circuit, registry, pin('A', 'out0'), pin('B', 'out0'))).toBe('same-direction');
    expect(connectionRejection(circuit, registry, pin('A', 'out0'), pin('G', 'in0'))).toBe('duplicate');
    expect(connectionRejection(circuit, registry, pin('B', 'out0'), pin('G', 'in1'))).toBeNull();
  });

  it('отпускание на исходном пине — не ошибка (это клик)', () => {
    expect(connectionRejection(circuit, registry, pin('A', 'out0'), pin('A', 'out0'))).toBeNull();
  });

  it('для каждой причины есть текст на русском', () => {
    for (const reason of ['same-direction', 'duplicate', 'unknown-pin'] as const) {
      expect(ru.notifications.connection[reason].length).toBeGreaterThan(10);
    }
  });
});
