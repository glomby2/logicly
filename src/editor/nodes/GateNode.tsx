import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { ElementNode } from '../adapters/flowMapping';
import { usePinSignal } from '../hooks/useSignals';
import { GateSymbol } from '../symbols/GateSymbol';
import { GATE_SYMBOLS } from '../symbols/gateShapes';
import { BoxNode } from './BoxNode';
import { NodeLabel } from './NodeLabel';
import { PinHandles } from './PinHandles';

export const GateNode = memo(function GateNode(props: NodeProps<ElementNode>) {
  const { id, data, selected } = props;
  const { component, geometry, title } = data;
  const symbol = GATE_SYMBOLS.get(component.type);
  const outputPin = geometry.pins.find((pin) => pin.direction === 'output');
  const output = usePinSignal(id, outputPin?.id ?? '');

  // Вентиль без ANSI-символа рисуется универсальным прямоугольником.
  if (!symbol) return <BoxNode {...props} />;

  return (
    <div
      className="relative"
      style={{ width: geometry.width, height: geometry.height }}
      aria-label={title}
      data-testid={`node-${id}`}
      data-type={component.type}
      data-output={String(output)}
    >
      <GateSymbol symbol={symbol} geometry={geometry} output={output} selected={selected} />
      <NodeLabel text={component.label} />
      <PinHandles nodeId={id} geometry={geometry} />
    </div>
  );
});
