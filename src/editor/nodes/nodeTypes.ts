import type { NodeTypes } from '@xyflow/react';
import type { NodeKind } from '../layout/geometry';
import { BoxNode } from './BoxNode';
import { GateNode } from './GateNode';
import { InputNode } from './InputNode';
import { MuxNode } from './MuxNode';
import { OutputNode } from './OutputNode';

export const nodeTypes = {
  gate: GateNode,
  input: InputNode,
  output: OutputNode,
  mux: MuxNode,
  box: BoxNode,
} satisfies Record<NodeKind, NodeTypes[string]>;
