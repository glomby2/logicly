import { useMemo, useState } from 'react';
import { appStores, useCircuitStore, useUiStore } from '@/store/hooks';
import { FlowCache } from '../adapters/flowMapping';

/** Узлы и рёбра React Flow, построенные из circuitStore и выделения в uiStore. */
export function useFlowElements() {
  const [cache] = useState(() => new FlowCache(appStores.registry));
  const circuit = useCircuitStore((state) => state.circuit);
  const selectedComponents = useUiStore((state) => state.selection.components);
  const selectedWires = useUiStore((state) => state.selection.wires);

  const nodes = useMemo(() => cache.nodes(circuit, new Set(selectedComponents)), [cache, circuit, selectedComponents]);
  const edges = useMemo(() => cache.edges(circuit, new Set(selectedWires)), [cache, circuit, selectedWires]);
  return { nodes, edges };
}
