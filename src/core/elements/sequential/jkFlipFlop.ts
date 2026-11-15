import { UNKNOWN, type KnownSignal, type Signal } from '../../logic/signal';
import { CLOCK_PIN, defineFlipFlop } from './flipFlop';

const known = (s: Signal): readonly KnownSignal[] => (s === UNKNOWN ? [0, 1] : [s]);

/** J K: 00 — хранение, 01 — сброс, 10 — установка, 11 — переключение. */
const jk = (j: KnownSignal, k: KnownSignal, q: KnownSignal): KnownSignal =>
  j === 1 && k === 1 ? (q === 1 ? 0 : 1) : j === 1 ? 1 : k === 1 ? 0 : q;

/**
 * Следующее Q — точное троичное значение: общее по всем заменам X на 0 и 1, иначе X.
 * Например, J = 1, K = 0 устанавливает 1 даже при Q = X (формула J·Q̄ + K̄·Q в логике
 * Клини дала бы X).
 */
export function jkNext(j: Signal, k: Signal, q: Signal): Signal {
  let result: Signal | undefined;
  for (const jv of known(j)) {
    for (const kv of known(k)) {
      for (const qv of known(q)) {
        const value = jk(jv, kv, qv);
        if (result === undefined) result = value;
        else if (result !== value) return UNKNOWN;
      }
    }
  }
  return result!;
}

/** JK-триггер: по переднему фронту CLK J — установка, K — сброс, J = K = 1 — переключение. */
export const JK_FLIP_FLOP = defineFlipFlop({
  type: 'JK_FLIP_FLOP',
  label: 'JK FLIP-FLOP',
  description: 'JK-триггер: по переднему фронту CLK J = 1 устанавливает, K = 1 сбрасывает, J = K = 1 переключает',
  inputs: [{ id: 'j', label: 'J' }, CLOCK_PIN, { id: 'k', label: 'K' }],
  next: ([j, k], q) => jkNext(j!, k!, q),
});
