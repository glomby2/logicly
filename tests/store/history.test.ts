import { describe, expect, it } from 'vitest';
import { emptyHistory, recordHistory, redoHistory, undoHistory } from '@/store/history';

describe('history', () => {
  it('undo возвращает последний снимок, redo — отменённое состояние', () => {
    let history = recordHistory(recordHistory(emptyHistory<string>(), 'a'), 'b');
    const undone = undoHistory(history, 'c')!;
    expect(undone.snapshot).toBe('b');
    history = undone.history;
    expect(history).toEqual({ past: ['a'], future: ['c'] });

    const redone = redoHistory(history, 'b')!;
    expect(redone.snapshot).toBe('c');
    expect(redone.history).toEqual({ past: ['a', 'b'], future: [] });
  });

  it('новая запись сбрасывает ветку повтора', () => {
    const history = undoHistory(recordHistory(emptyHistory<string>(), 'a'), 'b')!.history;
    expect(recordHistory(history, 'x')).toEqual({ past: ['x'], future: [] });
  });

  it('пустая история: undo и redo ничего не делают', () => {
    expect(undoHistory(emptyHistory<string>(), 'a')).toBeUndefined();
    expect(redoHistory(emptyHistory<string>(), 'a')).toBeUndefined();
  });

  it('ограничивает глубину истории', () => {
    let history = emptyHistory<number>();
    for (let i = 0; i < 10; i++) history = recordHistory(history, i, 3);
    expect(history.past).toEqual([7, 8, 9]);
  });
});
