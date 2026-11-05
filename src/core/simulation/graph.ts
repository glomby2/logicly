export interface GraphAnalysis {
  /** Позиция узла в обратном постпорядке DFS: для графа без циклов — топологический порядок. */
  readonly rank: readonly number[];
  /** Входит ли узел в цикл (сильно связная компонента из 2+ узлов или петля на себя). */
  readonly inCycle: readonly boolean[];
}

type Adjacency = readonly (readonly number[])[];

/** Итеративный DFS (без рекурсии — устойчив к глубоким схемам). Вызывает `onFinish` в постпорядке. */
function depthFirst(start: number, edges: Adjacency, visited: Uint8Array, onFinish: (node: number) => void): void {
  if (visited[start]) return;
  visited[start] = 1;
  const stack: [node: number, next: number][] = [[start, 0]];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    const children = edges[frame[0]]!;
    if (frame[1] < children.length) {
      const child = children[frame[1]++]!;
      if (!visited[child]) {
        visited[child] = 1;
        stack.push([child, 0]);
      }
    } else {
      onFinish(frame[0]);
      stack.pop();
    }
  }
}

/**
 * Ранжирует узлы и находит циклы (алгоритм Косарайю).
 * Обход начинается с источников (узлов без входящих рёбер), затем с остальных по порядку.
 */
export function analyzeGraph(successors: Adjacency): GraphAnalysis {
  const count = successors.length;
  const predecessors: number[][] = Array.from({ length: count }, () => []);
  successors.forEach((targets, node) => targets.forEach((target) => predecessors[target]!.push(node)));

  const nodes = Array.from({ length: count }, (_, i) => i);
  const startOrder = [
    ...nodes.filter((n) => predecessors[n]!.length === 0),
    ...nodes.filter((n) => predecessors[n]!.length > 0),
  ];

  const postorder: number[] = [];
  const visited = new Uint8Array(count);
  for (const node of startOrder) depthFirst(node, successors, visited, (n) => postorder.push(n));

  const topological = postorder.reverse();
  const rank = new Array<number>(count);
  topological.forEach((node, position) => (rank[node] = position));

  const inCycle = new Array<boolean>(count).fill(false);
  const assigned = new Uint8Array(count);
  for (const node of topological) {
    const group: number[] = [];
    depthFirst(node, predecessors, assigned, (n) => group.push(n));
    if (group.length > 1) group.forEach((n) => (inCycle[n] = true));
  }
  successors.forEach((targets, node) => {
    if (targets.includes(node)) inCycle[node] = true;
  });

  return { rank, inCycle };
}
