import { UNKNOWN, type Signal } from './signal';

/*
 * Трёхзначная логика Клини.
 * Доминирующее значение (0 для AND, 1 для OR) определяет результат даже при наличии X.
 * Все операции монотонны: замена входа на X может изменить результат только на X.
 */

export function not(a: Signal): Signal {
  if (a === UNKNOWN) return UNKNOWN;
  return a === 1 ? 0 : 1;
}

export function and(inputs: readonly Signal[]): Signal {
  let unknown = false;
  for (const input of inputs) {
    if (input === 0) return 0;
    if (input === UNKNOWN) unknown = true;
  }
  return unknown ? UNKNOWN : 1;
}

export function or(inputs: readonly Signal[]): Signal {
  let unknown = false;
  for (const input of inputs) {
    if (input === 1) return 1;
    if (input === UNKNOWN) unknown = true;
  }
  return unknown ? UNKNOWN : 0;
}

/** Чётность: 1, если число единиц нечётное. Любой X делает результат неопределённым. */
export function xor(inputs: readonly Signal[]): Signal {
  let parity: Signal = 0;
  for (const input of inputs) {
    if (input === UNKNOWN) return UNKNOWN;
    if (input === 1) parity = parity === 1 ? 0 : 1;
  }
  return parity;
}

/** Объединение двух значений: совпадающие сохраняются, различающиеся дают X. */
export function join(a: Signal, b: Signal): Signal {
  return a === b ? a : UNKNOWN;
}
