import { resolveConnection } from '@/core/circuit';
import type { ElementRegistry } from '@/core/elements';
import type { Circuit, PinRef } from '@/core/types/circuit';

/**
 * Можно ли соединить пины — тем же правилом, что применяет `circuitStore.connect`.
 * Соединение на занятый вход допустимо (старый провод будет заменён).
 */
export function canConnect(circuit: Circuit, registry: ElementRegistry, a: PinRef, b: PinRef): boolean {
  return resolveConnection(circuit, registry, a, b).ok;
}
