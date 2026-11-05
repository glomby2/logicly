/**
 * Очередь элементов с приоритетом по рангу (двоичная куча).
 * Элемент не может находиться в очереди дважды.
 */
export class RankQueue {
  private readonly heap: number[] = [];
  private readonly queued: Uint8Array;
  private readonly ranks: readonly number[];

  constructor(ranks: readonly number[]) {
    this.ranks = ranks;
    this.queued = new Uint8Array(ranks.length);
  }

  get size(): number {
    return this.heap.length;
  }

  push(item: number): void {
    if (this.queued[item]) return;
    this.queued[item] = 1;
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  /** Извлекает элемент с наименьшим рангом. */
  pop(): number {
    const top = this.heap[0];
    if (top === undefined) throw new Error('Очередь пуста');
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    this.queued[top] = 0;
    return top;
  }

  clear(): void {
    for (const item of this.heap) this.queued[item] = 0;
    this.heap.length = 0;
  }

  private less(a: number, b: number): boolean {
    return this.ranks[this.heap[a]!]! < this.ranks[this.heap[b]!]!;
  }

  private swap(a: number, b: number): void {
    const heap = this.heap;
    [heap[a], heap[b]] = [heap[b]!, heap[a]!];
  }

  private siftUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.less(index, parent)) return;
      this.swap(index, parent);
      index = parent;
    }
  }

  private siftDown(index: number): void {
    const size = this.heap.length;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < size && this.less(left, smallest)) smallest = left;
      if (right < size && this.less(right, smallest)) smallest = right;
      if (smallest === index) return;
      this.swap(index, smallest);
      index = smallest;
    }
  }
}
