import { describe, expect, it } from 'vitest';
import type { EdgeChange, NodeChange } from '@xyflow/react';
import { applySelectionChanges, collectMoves } from '@/editor/adapters/flowChanges';
import { EMPTY_SELECTION } from '@/store';

describe('collectMoves', () => {
  it('берёт только изменения позиции с координатами', () => {
    const changes: NodeChange[] = [
      { type: 'position', id: 'a', position: { x: 10, y: 20 }, dragging: true },
      { type: 'position', id: 'b', dragging: false },
      { type: 'dimensions', id: 'a', dimensions: { width: 1, height: 1 } },
      { type: 'select', id: 'a', selected: true },
    ];
    expect(collectMoves(changes)).toEqual([{ id: 'a', position: { x: 10, y: 20 } }]);
  });
});

describe('applySelectionChanges', () => {
  it('без изменений выделения — null', () => {
    expect(applySelectionChanges(EMPTY_SELECTION, [{ type: 'position', id: 'a' }], [])).toBeNull();
  });

  it('добавляет и снимает выделение узлов и рёбер', () => {
    const selection = { components: ['a', 'b'], wires: ['w1'] };
    const nodes: NodeChange[] = [
      { type: 'select', id: 'b', selected: false },
      { type: 'select', id: 'c', selected: true },
    ];
    const edges: EdgeChange[] = [
      { type: 'select', id: 'w1', selected: false },
      { type: 'select', id: 'w2', selected: true },
    ];
    expect(applySelectionChanges(selection, nodes, edges)).toEqual({ components: ['a', 'c'], wires: ['w2'] });
  });

  it('изменения, совпадающие с текущим выделением, — null (без лишних обновлений)', () => {
    const selection = { components: ['a'], wires: [] };
    expect(applySelectionChanges(selection, [{ type: 'select', id: 'a', selected: true }], [])).toBeNull();
  });
});
