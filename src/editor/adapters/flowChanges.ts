import type { EdgeChange, NodeChange } from '@xyflow/react';
import type { ComponentMove, Selection } from '@/store';

/** Перемещения узлов из изменений React Flow. Остальные изменения (размеры и т.п.) игнорируются. */
export function collectMoves(changes: readonly NodeChange[]): ComponentMove[] {
  const moves: ComponentMove[] = [];
  for (const change of changes) {
    if (change.type === 'position' && change.position) moves.push({ id: change.id, position: change.position });
  }
  return moves;
}

function applySelect(current: readonly string[], changes: readonly { id: string; selected: boolean }[]) {
  const result = new Set(current);
  for (const change of changes) {
    if (change.selected) result.add(change.id);
    else result.delete(change.id);
  }
  return [...result];
}

/** Новое выделение после изменений React Flow или `null`, если выделение не менялось. */
export function applySelectionChanges(
  selection: Selection,
  nodeChanges: readonly NodeChange[],
  edgeChanges: readonly EdgeChange[],
): Selection | null {
  const nodeSelects = nodeChanges.flatMap((c) => (c.type === 'select' ? [c] : []));
  const edgeSelects = edgeChanges.flatMap((c) => (c.type === 'select' ? [c] : []));
  if (nodeSelects.length === 0 && edgeSelects.length === 0) return null;

  const components = applySelect(selection.components, nodeSelects);
  const wires = applySelect(selection.wires, edgeSelects);
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id));
  return same(components, selection.components) && same(wires, selection.wires) ? null : { components, wires };
}
