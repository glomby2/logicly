import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { ElementNode } from '../adapters/flowMapping';
import { MuxSymbol } from '../symbols/MuxSymbol';
import { MUX_SYMBOLS } from '../symbols/muxShapes';
import { BoxNode } from './BoxNode';
import { NodeLabel } from './NodeLabel';
import { PinHandles } from './PinHandles';

/** MUX / DEMUX: трапеция с подписями пинов. Сигналы показывают пины, корпус нейтрален. */
export const MuxNode = memo(function MuxNode(props: NodeProps<ElementNode>) {
  const { id, data, selected } = props;
  const { component, geometry, title, variant } = data;
  const orientation = MUX_SYMBOLS.get(component.type);

  if (!orientation) return <BoxNode {...props} />;

  return (
    <div
      className="relative"
      style={{ width: geometry.width, height: geometry.height }}
      aria-label={variant ? `${title} ${variant}` : title}
      data-testid={`node-${id}`}
      data-type={component.type}
    >
      <MuxSymbol orientation={orientation} geometry={geometry} title={title} variant={variant} selected={selected} />
      <NodeLabel text={component.label} />
      <PinHandles nodeId={id} geometry={geometry} />
    </div>
  );
});
