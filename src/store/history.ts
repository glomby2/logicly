/** Стек отмены и повтора. Хранит неизменяемые снимки — структурное разделение делает их дешёвыми. */
export interface HistoryState<T> {
  readonly past: readonly T[];
  readonly future: readonly T[];
}

export const HISTORY_LIMIT = 100;

export function emptyHistory<T>(): HistoryState<T> {
  return { past: [], future: [] };
}

/** Запоминает снимок перед изменением; ветка повтора сбрасывается. */
export function recordHistory<T>(history: HistoryState<T>, snapshot: T, limit = HISTORY_LIMIT): HistoryState<T> {
  return { past: [...history.past, snapshot].slice(-limit), future: [] };
}

export interface HistoryStep<T> {
  readonly history: HistoryState<T>;
  readonly snapshot: T;
}

export function undoHistory<T>(history: HistoryState<T>, current: T): HistoryStep<T> | undefined {
  const snapshot = history.past.at(-1);
  if (snapshot === undefined) return undefined;
  return { snapshot, history: { past: history.past.slice(0, -1), future: [current, ...history.future] } };
}

export function redoHistory<T>(history: HistoryState<T>, current: T): HistoryStep<T> | undefined {
  const [snapshot, ...future] = history.future;
  if (snapshot === undefined) return undefined;
  return { snapshot, history: { past: [...history.past, current], future } };
}
