import { describe, expect, it } from 'vitest';
import { RankQueue } from '@/core/simulation/rankQueue';

describe('RankQueue', () => {
  it('извлекает элементы по возрастанию ранга', () => {
    const ranks = [5, 2, 9, 0, 7, 3];
    const queue = new RankQueue(ranks);
    [0, 1, 2, 3, 4, 5].forEach((i) => queue.push(i));
    const order: number[] = [];
    while (queue.size > 0) order.push(queue.pop());
    expect(order.map((i) => ranks[i])).toEqual([0, 2, 3, 5, 7, 9]);
  });

  it('не добавляет элемент повторно, пока он в очереди', () => {
    const queue = new RankQueue([0, 1]);
    queue.push(1);
    queue.push(1);
    expect(queue.size).toBe(1);
    expect(queue.pop()).toBe(1);
    queue.push(1);
    expect(queue.size).toBe(1);
  });

  it('clear очищает очередь и позволяет добавлять элементы снова', () => {
    const queue = new RankQueue([0, 1, 2]);
    queue.push(0);
    queue.push(2);
    queue.clear();
    expect(queue.size).toBe(0);
    queue.push(2);
    expect(queue.pop()).toBe(2);
  });

  it('pop из пустой очереди — ошибка', () => {
    expect(() => new RankQueue([]).pop()).toThrow();
  });
});
