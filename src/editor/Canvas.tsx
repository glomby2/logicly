import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type FinalConnectionState,
  type HandleType,
  type IsValidConnection,
  type NodeChange,
} from '@xyflow/react';
import { useCallback, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { removeWires } from '@/core/circuit';
import type { Circuit } from '@/core/types/circuit';
import { ru } from '@/i18n/ru';
import { appStores } from '@/store/hooks';
import { applySelectionChanges, collectMoves } from './adapters/flowChanges';
import {
  connectionPins,
  pinFromHandle,
  type ElementNode,
  type FlowConnectionLike,
  type WireEdge,
} from './adapters/flowMapping';
import { canConnect, connectionRejection } from './connectionRules';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import type { MenuCommand, MenuTarget } from './contextMenuModel';
import { edgeTypes } from './edges/edgeTypes';
import type { NodeKind } from './layout/geometry';
import { useFitViewOnLoad } from './hooks/useFitViewOnLoad';
import { useFlowElements } from './hooks/useFlowElements';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { nodeTypes } from './nodes/nodeTypes';
import { ELEMENT_DRAG_TYPE, placementPosition } from './placement';
import { SIGNAL_COLORS } from './signalStyle';
import { DEFAULT_VIEWPORT, FIT_VIEW_OPTIONS } from './viewport';
import { ZoomControls } from './ZoomControls';

const MULTI_SELECT_KEYS = ['Shift', 'Control', 'Meta'];
const MINIMAP_COLORS: Record<NodeKind, string> = {
  input: '#a7f3d0',
  output: '#fde68a',
  gate: '#cbd5e1',
  mux: '#cbd5e1',
  box: '#94a3b8',
};

const { circuit: circuitStore, ui: uiStore, commands } = appStores;

/** Провод отпущен на пине, но соединение недопустимо — объяснить почему. */
function notifyRejection(circuit: Circuit, state: FinalConnectionState) {
  if (!state.toHandle || state.isValid) return;
  const from = pinFromHandle(state.fromHandle?.nodeId, state.fromHandle?.id);
  const to = pinFromHandle(state.toHandle.nodeId, state.toHandle.id);
  const reason = from && to ? connectionRejection(circuit, appStores.registry, from, to) : null;
  if (reason) uiStore.getState().notify(ru.notifications.connection[reason], 'warning');
}

/**
 * Рабочее поле. React Flow — только визуальный слой: узлы и провода строятся из circuitStore,
 * а все изменения уходят в хранилища через их действия и команды.
 */
export function Canvas() {
  const { nodes, edges } = useFlowElements();
  const { screenToFlowPosition, fitView } = useReactFlow<ElementNode, WireEdge>();
  useFitViewOnLoad();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  /** Провод, конец которого сейчас переподключается: при проверке соединения его не учитываем. */
  const reconnecting = useRef<string | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);
  const onEscape = useCallback(() => {
    setMenu(null);
    uiStore.getState().cancelPlacement();
    uiStore.getState().clearSelection();
  }, []);
  useKeyboardShortcuts(onEscape);

  /** Клик или тап по пустому полю: в режиме размещения ставит выбранный элемент. */
  const onPaneClick = useCallback(
    (event: ReactMouseEvent) => {
      setMenu(null);
      const { placement } = uiStore.getState();
      if (!placement) return;
      commands.placeElement(placement, placementPosition(screenToFlowPosition({ x: event.clientX, y: event.clientY })));
    },
    [screenToFlowPosition],
  );

  const onNodesChange = useCallback((changes: NodeChange<ElementNode>[]) => {
    const moves = collectMoves(changes);
    if (moves.length > 0) circuitStore.getState().moveComponents(moves);
    const selection = applySelectionChanges(uiStore.getState().selection, changes, []);
    if (selection) uiStore.getState().select(selection);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<WireEdge>[]) => {
    const selection = applySelectionChanges(uiStore.getState().selection, [], changes);
    if (selection) uiStore.getState().select(selection);
  }, []);

  const isValidConnection: IsValidConnection<WireEdge> = useCallback((connection) => {
    const pins = connectionPins(connection);
    if (!pins) return false;
    const { circuit } = circuitStore.getState();
    const base = reconnecting.current ? removeWires(circuit, [reconnecting.current]) : circuit;
    return canConnect(base, appStores.registry, pins[0], pins[1]);
  }, []);

  const onConnect = useCallback((connection: FlowConnectionLike) => {
    const pins = connectionPins(connection);
    if (!pins) return;
    const check = circuitStore.getState().connect(pins[0], pins[1]);
    if (check.ok && check.replaces) uiStore.getState().notify(ru.notifications.wireReplaced, 'info');
  }, []);

  const onConnectEnd = useCallback((_: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    if (reconnecting.current) return;
    notifyRejection(circuitStore.getState().circuit, state);
  }, []);

  const onReconnectStart = useCallback((_: ReactMouseEvent, edge: Edge) => {
    reconnecting.current = edge.id;
  }, []);

  const onReconnect = useCallback((edge: Edge, connection: FlowConnectionLike) => {
    const pins = connectionPins(connection);
    if (pins) circuitStore.getState().reconnect(edge.id, pins[0], pins[1]);
  }, []);

  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, edge: Edge, __: HandleType, state: FinalConnectionState) => {
      reconnecting.current = null;
      // Конец провода брошен на пустое место — провод удаляется.
      if (!state.toHandle) circuitStore.getState().remove({ wires: [edge.id] });
      else notifyRejection(removeWires(circuitStore.getState().circuit, [edge.id]), state);
    },
    [],
  );

  const beginDrag = useCallback(() => circuitStore.getState().beginBatch(), []);
  const endDrag = useCallback(() => circuitStore.getState().endBatch(), []);

  const openMenu = useCallback((event: ReactMouseEvent | MouseEvent, target: MenuTarget) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, target });
  }, []);

  const onNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: ElementNode) => {
      const { selection, select } = uiStore.getState();
      if (!selection.components.includes(node.id)) select({ components: [node.id] });
      openMenu(event, { kind: 'node', id: node.id });
    },
    [openMenu],
  );

  const onSelectionContextMenu = useCallback(
    (event: ReactMouseEvent, selected: ElementNode[]) => {
      if (selected[0]) openMenu(event, { kind: 'node', id: selected[0].id });
    },
    [openMenu],
  );

  const onEdgeContextMenu = useCallback(
    (event: ReactMouseEvent, edge: WireEdge) => {
      const { selection, select } = uiStore.getState();
      if (!selection.wires.includes(edge.id)) select({ wires: [edge.id] });
      openMenu(event, { kind: 'edge', id: edge.id });
    },
    [openMenu],
  );

  const onPaneContextMenu = useCallback(
    (event: ReactMouseEvent | MouseEvent) =>
      openMenu(event, { kind: 'pane', flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }) }),
    [openMenu, screenToFlowPosition],
  );

  const runCommand = useCallback(
    (command: MenuCommand, target: MenuTarget) => {
      switch (command) {
        case 'paste':
          commands.paste(target.kind === 'pane' ? target.flowPosition : undefined);
          break;
        case 'selectAll':
          commands.selectAll();
          break;
        case 'fitView':
          void fitView(FIT_VIEW_OPTIONS);
          break;
        case 'truthTable':
          uiStore.getState().openDialog('truth-table');
          break;
        case 'copy':
          commands.copySelection();
          break;
        case 'cut':
          commands.cutSelection();
          break;
        case 'duplicate':
          commands.duplicateSelection();
          break;
        case 'delete':
          commands.deleteSelection();
          break;
        case 'toggle':
          if (target.kind === 'node') commands.toggleInput(target.id);
          break;
        case 'rename':
          // Переименование выполняется формой внутри меню.
          break;
      }
    },
    [fitView],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(ELEMENT_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const type = event.dataTransfer.getData(ELEMENT_DRAG_TYPE);
      if (!type) return;
      event.preventDefault();
      commands.placeElement(type, placementPosition(screenToFlowPosition({ x: event.clientX, y: event.clientY })));
    },
    [screenToFlowPosition],
  );

  return (
    <div className="absolute inset-0" data-canvas onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow<ElementNode, WireEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        onNodeDragStart={beginDrag}
        onNodeDragStop={endDrag}
        onSelectionDragStart={beginDrag}
        onSelectionDragStop={endDrag}
        onNodeContextMenu={onNodeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onMoveStart={closeMenu}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={28}
        connectionLineStyle={{ stroke: '#38bdf8', strokeWidth: 2 }}
        edgesReconnectable
        reconnectRadius={12}
        deleteKeyCode={null}
        // Стрелки обрабатывает useKeyboardShortcuts — иначе выделенное сдвигалось бы дважды.
        disableKeyboardA11y
        selectionKeyCode="Shift"
        multiSelectionKeyCode={MULTI_SELECT_KEYS}
        snapToGrid
        snapGrid={[10, 10]}
        minZoom={0.2}
        maxZoom={3}
        zoomOnDoubleClick={false}
        // Без автоматического fitView: иначе поле «прыгает», когда на пустой холст кладут первый элемент.
        defaultViewport={DEFAULT_VIEWPORT}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#334155" />
        <ZoomControls />
        <MiniMap<ElementNode>
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(node) => (node.type ? MINIMAP_COLORS[node.type] : SIGNAL_COLORS.low)}
          maskColor="rgba(2, 6, 23, 0.6)"
          className="!hidden sm:!block"
        />
      </ReactFlow>
      {menu && <ContextMenu menu={menu} onCommand={runCommand} onClose={closeMenu} />}
    </div>
  );
}
