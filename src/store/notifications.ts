export type NotificationTone = 'info' | 'warning';

export interface AppNotification {
  readonly id: number;
  readonly message: string;
  readonly tone: NotificationTone;
  /** Сколько раз подряд пришло это сообщение. */
  readonly count: number;
  /** Меняется при каждом повторе — по нему интерфейс перезапускает таймер скрытия. */
  readonly revision: number;
}

/** Не больше трёх уведомлений одновременно: старые вытесняются новыми. */
export const MAX_NOTIFICATIONS = 3;

/**
 * Добавляет уведомление в очередь. Повтор того же сообщения не создаёт новое, а обновляет
 * существующее (счётчик, ревизия) и переносит его в конец — так очередь не заполняется
 * одинаковыми сообщениями.
 */
export function pushNotification(
  queue: readonly AppNotification[],
  message: string,
  tone: NotificationTone,
  nextId: number,
  limit = MAX_NOTIFICATIONS,
): AppNotification[] {
  const existing = queue.find((n) => n.message === message && n.tone === tone);
  const rest = queue.filter((n) => n !== existing);
  const entry: AppNotification = existing
    ? { ...existing, count: existing.count + 1, revision: existing.revision + 1 }
    : { id: nextId, message, tone, count: 1, revision: 0 };
  return [...rest, entry].slice(-limit);
}
