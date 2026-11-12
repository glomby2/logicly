import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/cn';
import type { ElementNode } from '../adapters/flowMapping';
import { NodeLabel } from './NodeLabel';
import { PinHandles } from './PinHandles';

/** Универсальный символ: прямоугольник с названием и подписями пинов. Подходит для любого нового элемента. */
export const BoxNode = memo(function BoxNode({ id, data, selected }: NodeProps<ElementNode>) {
  const { component, geometry, title } = data;
  return (
    <div
      className={cn(
        'relative rounded-md border-2 bg-slate-800 text-slate-200',
        selected ? 'border-sky-400' : 'border-slate-400',
      )}
      style={{ width: geometry.width, height: geometry.height }}
      data-testid={`node-${id}`}
      data-type={component.type}
    >
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold tracking-wide">
        {title}
      </div>
      {geometry.pins
        .filter((pin) => pin.label)
        .map((pin) => (
          <span
            key={pin.id}
            className="pointer-events-none absolute -translate-y-1/2 text-[10px] text-slate-400"
            style={
              pin.side === 'right'
                ? { right: 6, top: pin.y }
                : pin.side === 'left'
                  ? { left: 6, top: pin.y }
                  : { left: pin.x - 6, top: pin.side === 'top' ? 10 : geometry.height - 10 }
            }
          >
            {pin.label}
          </span>
        ))}
      <NodeLabel text={component.label} />
      <PinHandles nodeId={id} geometry={geometry} />
    </div>
  );
});
