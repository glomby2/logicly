import { describe, expect, it } from 'vitest';
import { Position } from '@xyflow/react';
import { createDefaultRegistry } from '@/core/elements';
import { connectionPins, FlowCache, pinFromHandle, toFlowEdge, toFlowNode } from '@/editor/adapters/flowMapping';
import { HANDLE_SIZE } from '@/editor/layout/geometry';
import { CircuitBuilder } from '../helpers/circuitBuilder';

const registry = createDefaultRegistry();
const circuit = () =>
  new CircuitBuilder().input('A').gate('G', 'AND', 3).add('M', 'MYSTERY').wire('A', 'G.in1').build();

describe('toFlowNode', () => {
  it('строит узел вентиля с размерами и явными точками подключения', () => {
    const node = toFlowNode(circuit().components[1]!, registry, true);
    expect(node).toMatchObject({ id: 'G', type: 'gate', position: { x: 0, y: 0 }, selected: true });
    expect(node.width).toBe(node.data.geometry.width);
    expect(node.measured).toEqual({ width: node.width, height: node.height });
    expect(node.data.title).toBe('AND');
    expect(node.handles!.map((h) => [h.id, h.type, h.position])).toEqual([
      ['in0', 'target', Position.Left],
      ['in1', 'target', Position.Left],
      ['in2', 'target', Position.Left],
      ['out0', 'source', Position.Right],
    ]);
    const out = node.data.geometry.pins.find((p) => p.id === 'out0')!;
    expect(node.handles![3]).toMatchObject({
      x: out.x - HANDLE_SIZE / 2,
      y: out.y - HANDLE_SIZE / 2,
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
    });
  });

  it('INPUT и OUTPUT — свои виды узлов; неизвестный тип — прямоугольник без пинов', () => {
    const nodes = circuit().components.map((c) => toFlowNode(c, registry, false));
    expect(nodes.map((n) => n.type)).toEqual(['input', 'gate', 'box']);
    expect(nodes[2]!.handles).toEqual([]);
    expect(nodes[2]!.data.title).toBe('MYSTERY');
  });
});

describe('toFlowEdge', () => {
  it('провод → ребро от выхода к входу', () => {
    expect(toFlowEdge(circuit().wires[0]!, false)).toMatchObject({
      id: 'w1',
      type: 'wire',
      source: 'A',
      sourceHandle: 'out0',
      target: 'G',
      targetHandle: 'in1',
      selected: false,
    });
  });
});

describe('FlowCache', () => {
  it('переиспользует неизменённые узлы и рёбра', () => {
    const cache = new FlowCache(registry);
    const first = circuit();
    const nodes1 = cache.nodes(first, new Set());
    const edges1 = cache.edges(first, new Set());

    // Перемещение одного элемента: новый объект только для него.
    const moved = {
      ...first,
      components: first.components.map((c) => (c.id === 'G' ? { ...c, position: { x: 50, y: 0 } } : c)),
    };
    const nodes2 = cache.nodes(moved, new Set());
    expect(nodes2[0]).toBe(nodes1[0]);
    expect(nodes2[1]).not.toBe(nodes1[1]);
    expect(nodes2[1]!.position).toEqual({ x: 50, y: 0 });
    expect(nodes2[2]).toBe(nodes1[2]);
    expect(cache.edges(moved, new Set())[0]).toBe(edges1[0]);
  });

  it('изменение выделения пересоздаёт только затронутые объекты', () => {
    const cache = new FlowCache(registry);
    const c = circuit();
    const before = cache.nodes(c, new Set());
    const after = cache.nodes(c, new Set(['A']));
    expect(after[0]).not.toBe(before[0]);
    expect(after[0]!.selected).toBe(true);
    expect(after[1]).toBe(before[1]);

    const edgeBefore = cache.edges(c, new Set());
    expect(cache.edges(c, new Set(['w1']))[0]).not.toBe(edgeBefore[0]);
  });

  it('удалённые элементы исчезают из результата', () => {
    const cache = new FlowCache(registry);
    const c = circuit();
    cache.nodes(c, new Set());
    expect(cache.nodes({ ...c, components: c.components.slice(0, 1) }, new Set()).map((n) => n.id)).toEqual(['A']);
  });
});

describe('соединения React Flow → пины', () => {
  it('pinFromHandle требует узел и пин', () => {
    expect(pinFromHandle('A', 'out0')).toEqual({ componentId: 'A', pinId: 'out0' });
    expect(pinFromHandle('A', null)).toBeNull();
    expect(pinFromHandle(undefined, 'out0')).toBeNull();
  });

  it('connectionPins сохраняет порядок — направление нормализует ядро', () => {
    expect(connectionPins({ source: 'G', sourceHandle: 'in0', target: 'A', targetHandle: 'out0' })).toEqual([
      { componentId: 'G', pinId: 'in0' },
      { componentId: 'A', pinId: 'out0' },
    ]);
    expect(connectionPins({ source: 'G', sourceHandle: undefined, target: 'A', targetHandle: 'out0' })).toBeNull();
  });
});
