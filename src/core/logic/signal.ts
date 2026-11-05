/**
 * Логический сигнал.
 * `X` — неопределённое значение: колебание в нестабильной петле или неизвестное состояние.
 */
export type Signal = 0 | 1 | 'X';

/** Определённый сигнал (без X). */
export type KnownSignal = 0 | 1;

export const UNKNOWN = 'X' satisfies Signal;

/** Все значения сигнала — для перебора в тестах и таблицах. */
export const SIGNALS: readonly Signal[] = [0, 1, UNKNOWN];

export function isKnown(signal: Signal): signal is KnownSignal {
  return signal !== UNKNOWN;
}

export function fromBoolean(value: boolean): KnownSignal {
  return value ? 1 : 0;
}
