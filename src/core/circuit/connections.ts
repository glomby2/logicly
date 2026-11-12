import type { ElementRegistry } from '../elements/registry';
import type { Circuit, PinRef, Wire, WireId } from '../types/circuit';
import { removeWires } from './editing';
import { findPin, samePin } from './pins';

export type ConnectionError = 'unknown-pin' | 'same-direction' | 'duplicate';

export type ConnectionCheck =
  | {
      readonly ok: true;
      readonly from: PinRef;
      readonly to: PinRef;
      /** Провод, который будет заменён: у входа может быть только один источник. */
      readonly replaces?: WireId;
    }
  | { readonly ok: false; readonly reason: ConnectionError };

export function findWireToInput(circuit: Circuit, input: PinRef): Wire | undefined {
  return circuit.wires.find((wire) => samePin(wire.to, input));
}

export function isPinConnected(circuit: Circuit, pin: PinRef): boolean {
  return circuit.wires.some((wire) => samePin(wire.from, pin) || samePin(wire.to, pin));
}

/**
 * Проверяет соединение двух пинов в любом порядке и приводит его к направлению
 * выход → вход. Соединение выхода элемента с его же входом разрешено (обратная связь).
 */
export function resolveConnection(
  circuit: Circuit,
  registry: ElementRegistry,
  a: PinRef,
  b: PinRef,
): ConnectionCheck {
  const pinA = findPin(registry, circuit, a);
  const pinB = findPin(registry, circuit, b);
  if (!pinA || !pinB) return { ok: false, reason: 'unknown-pin' };
  if (pinA.direction === pinB.direction) return { ok: false, reason: 'same-direction' };

  const [from, to] = pinA.direction === 'output' ? [a, b] : [b, a];
  const existing = findWireToInput(circuit, to);
  if (existing && samePin(existing.from, from)) return { ok: false, reason: 'duplicate' };

  return existing ? { ok: true, from, to, replaces: existing.id } : { ok: true, from, to };
}

/**
 * Переподключает провод: удаляет `wireId` и соединяет пины `a` и `b`, сохраняя id провода.
 * Если новое соединение недопустимо или совпадает с прежним, схема не меняется.
 */
export function reconnect(
  circuit: Circuit,
  registry: ElementRegistry,
  wireId: WireId,
  a: PinRef,
  b: PinRef,
): { circuit: Circuit; check: ConnectionCheck } {
  const existing = circuit.wires.find((wire) => wire.id === wireId);
  if (!existing) return { circuit, check: { ok: false, reason: 'unknown-pin' } };

  const without = removeWires(circuit, [wireId]);
  const check = resolveConnection(without, registry, a, b);
  if (!check.ok) return { circuit, check };
  if (samePin(check.from, existing.from) && samePin(check.to, existing.to)) return { circuit, check };
  return connect(without, registry, a, b, wireId);
}

/** Добавляет провод между пинами. Существующий провод на том же входе заменяется. */
export function connect(
  circuit: Circuit,
  registry: ElementRegistry,
  a: PinRef,
  b: PinRef,
  wireId: WireId,
): { circuit: Circuit; check: ConnectionCheck } {
  if (circuit.wires.some((wire) => wire.id === wireId)) {
    throw new Error(`Провод "${wireId}" уже существует`);
  }
  const check = resolveConnection(circuit, registry, a, b);
  if (!check.ok) return { circuit, check };

  const wires = circuit.wires.filter((wire) => wire.id !== check.replaces);
  return {
    circuit: { ...circuit, wires: [...wires, { id: wireId, from: check.from, to: check.to }] },
    check,
  };
}
