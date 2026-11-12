import { resolveConnection, samePin, type ConnectionError } from '@/core/circuit';
import type { ElementRegistry } from '@/core/elements';
import type { Circuit, PinRef } from '@/core/types/circuit';

/**
 * Можно ли соединить пины — тем же правилом, что применяет `circuitStore.connect`.
 * Соединение на занятый вход допустимо (старый провод будет заменён).
 */
export function canConnect(circuit: Circuit, registry: ElementRegistry, a: PinRef, b: PinRef): boolean {
  return resolveConnection(circuit, registry, a, b).ok;
}

/**
 * Почему соединение не создано — для уведомления пользователя.
 * `null`, если соединение допустимо или провод отпущен на том же пине, с которого начат
 * (это обычный клик по пину, а не попытка соединения).
 */
export function connectionRejection(
  circuit: Circuit,
  registry: ElementRegistry,
  from: PinRef,
  to: PinRef,
): ConnectionError | null {
  if (samePin(from, to)) return null;
  const check = resolveConnection(circuit, registry, from, to);
  return check.ok ? null : check.reason;
}
