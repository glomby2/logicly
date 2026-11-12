import type { NodeTypes } from '@xyflow/react';
import type { NodeKind } from '../layout/geometry';
import { BoxNode } from './BoxNode';
import { GateNode } from './GateNode';
import { InputNode } from './InputNode';
import { OutputNode } from './OutputNode';

export const nodeTypes = {
  gate: GateNode,
  input: InputNode,
  output: OutputNode,
  box: BoxNode,
} satisfies Record<NodeKind, NodeTypes[string]>;
