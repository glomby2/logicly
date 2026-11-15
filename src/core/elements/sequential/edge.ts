import { join } from '../../logic/ops';
import { UNKNOWN, type Signal } from '../../logic/signal';

/*
 * Детектор переднего фронта для триггеров. Элемент хранит предыдущий уровень такта
 * в своём состоянии; движок публикует выходы элементов с состоянием на границе
 * дельта-цикла, поэтому все триггеры одного фронта видят данные до фронта.
 */

/** Запомненный уровень такта; `null` — такт ещё не наблюдался (включение, новый элемент). */
export type ClockMemory = Signal | null;

/**
 * - `none` — фронта нет (такт не наблюдался, CLK = 0, или 1 → 1);
 * - `rising` — передний фронт 0 → 1;
 * - `possible` — фронт возможен, но не достоверен (X сейчас или раньше).
 */
export type ClockEdge = 'none' | 'rising' | 'possible';

export function clockEdge(previous: ClockMemory, current: Signal): ClockEdge {
  if (previous === null || current === 0 || (previous === 1 && current === 1)) return 'none';
  return previous === 0 && current === 1 ? 'rising' : 'possible';
}

/**
 * Уровень такта для следующего вычисления. X при ненаблюдавшемся такте не запоминается:
 * иначе повторное вычисление с теми же входами увидело бы «возможный фронт»
 * и нарушило идемпотентность.
 */
export function rememberClock(previous: ClockMemory, current: Signal): ClockMemory {
  return previous === null && current === UNKNOWN ? null : current;
}

/** Новое Q: хранение без фронта, `next` по фронту, `join(Q, next)` при возможном фронте. */
export function clockedValue(edge: ClockEdge, q: Signal, next: Signal): Signal {
  switch (edge) {
    case 'none':
      return q;
    case 'rising':
      return next;
    case 'possible':
      return join(q, next);
  }
}
