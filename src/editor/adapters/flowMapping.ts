import { Position, type Connection, type Edge, type Node, type NodeHandle } from '@xyflow/react';
import { getComponentPins } from '@/core/circuit';
import type { ElementRegistry } from '@/core/elements';
import type { Circuit, CircuitComponent, PinRef, Wire } from '@/core/types/circuit';
import { computeGeometry, HANDLE_SIZE, type ElementGeometry, type NodeKind, type PinGeometry } from '../layout/geometry';
import { nodeKindOf } from '../symbols/gateShapes';

/*
 * Адаптер «доменная схема → React Flow». React Flow — только визуальный слой:
 * узлы и рёбра строятся из `Circuit`, а изменения из React Flow переводятся в действия хранилищ.
 */

export type ElementNodeData = {
  readonly component: CircuitComponent;
  readonly geometry: ElementGeometry;
  /** Название типа для отображения (AND, INPUT, …). */
  readonly title: string;
};

export type ElementNode = Node<ElementNodeData, NodeKind>;

export type WireEdgeData = { readonly wire: Wire };
export type WireEdge = Edge<WireEdgeData, 'wire'>;

const SIDE_POSITION = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
} as const;

export function handlePosition(pin: PinGeometry): Position {
  return SIDE_POSITION[pin.side];
}

/** Точки подключения задаются явно из геометрии — React Flow не нужно измерять DOM. */
function toHandle(pin: PinGeometry): NodeHandle {
  return {
    id: pin.id,
    type: pin.direction === 'input' ? 'target' : 'source',
    position: handlePosition(pin),
    x: pin.x - HANDLE_SIZE / 2,
    y: pin.y - HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
  };
}

export function toFlowNode(component: CircuitComponent, registry: ElementRegistry, selected: boolean): ElementNode {
  const pins = getComponentPins(registry, component) ?? { inputs: [], outputs: [] };
  const kind = nodeKindOf(component.type);
  const geometry = computeGeometry(kind, pins);
  const size = { width: geometry.width, height: geometry.height };
  return {
    id: component.id,
    type: kind,
    position: component.position,
    data: { component, geometry, title: registry.get(component.type)?.label ?? component.type },
    ...size,
    measured: size,
    handles: geometry.pins.map(toHandle),
    selected,
  };
}

export function toFlowEdge(wire: Wire, selected: boolean): WireEdge {
  return {
    id: wire.id,
    type: 'wire',
    source: wire.from.componentId,
    sourceHandle: wire.from.pinId,
    target: wire.to.componentId,
    targetHandle: wire.to.pinId,
    data: { wire },
    selected,
  };
}

/**
 * Строит узлы и рёбра, переиспользуя объекты, у которых не изменились исходные данные и выделение.
 * Благодаря этому при перетаскивании одного элемента React Flow пересоздаёт только его узел.
 */
export class FlowCache {
  private readonly registry: ElementRegistry;
  private nodeCache = new Map<string, { source: CircuitComponent; selected: boolean; node: ElementNode }>();
  private edgeCache = new Map<string, { source: Wire; selected: boolean; edge: WireEdge }>();

  constructor(registry: ElementRegistry) {
    this.registry = registry;
  }

  nodes(circuit: Circuit, selected: ReadonlySet<string>): ElementNode[] {
    const next = new Map<string, { source: CircuitComponent; selected: boolean; node: ElementNode }>();
    const nodes = circuit.components.map((component) => {
      const isSelected = selected.has(component.id);
      const cached = this.nodeCache.get(component.id);
      const node =
        cached && cached.source === component && cached.selected === isSelected
          ? cached.node
          : toFlowNode(component, this.registry, isSelected);
      next.set(component.id, { source: component, selected: isSelected, node });
      return node;
    });
    this.nodeCache = next;
    return nodes;
  }

  edges(circuit: Circuit, selected: ReadonlySet<string>): WireEdge[] {
    const next = new Map<string, { source: Wire; selected: boolean; edge: WireEdge }>();
    const edges = circuit.wires.map((wire) => {
      const isSelected = selected.has(wire.id);
      const cached = this.edgeCache.get(wire.id);
      const edge =
        cached && cached.source === wire && cached.selected === isSelected ? cached.edge : toFlowEdge(wire, isSelected);
      next.set(wire.id, { source: wire, selected: isSelected, edge });
      return edge;
    });
    this.edgeCache = next;
    return edges;
  }
}

/** Соединение или ребро React Flow: у ребра id пинов могут отсутствовать. */
export type FlowConnectionLike = Pick<Connection, 'source' | 'target'> & {
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
};

export function pinFromHandle(nodeId: string | null | undefined, handleId: string | null | undefined): PinRef | null {
  return nodeId && handleId ? { componentId: nodeId, pinId: handleId } : null;
}

/**
 * Пины соединения из React Flow. В свободном режиме соединение можно начать с любого пина,
 * поэтому `source` не обязательно выход — направление нормализует `resolveConnection`.
 */
export function connectionPins(connection: FlowConnectionLike) {
  const a = pinFromHandle(connection.source, connection.sourceHandle);
  const b = pinFromHandle(connection.target, connection.targetHandle);
  return a && b ? ([a, b] as const) : null;
}
