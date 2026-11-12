import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/cn';
import type { ElementNode } from '../adapters/flowMapping';
import { usePinSignal } from '../hooks/useSignals';
import { PinHandles } from './PinHandles';

/** OUTPUT: индикатор, который светится при 1 на входе. */
export const OutputNode = memo(function OutputNode({ id, data, selected }: NodeProps<ElementNode>) {
  const { component, geometry } = data;
  const inputPin = geometry.pins.find((pin) => pin.direction === 'input');
  const signal = usePinSignal(id, inputPin?.id ?? '');

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-md border-2 bg-slate-800',
        selected ? 'border-sky-400' : 'border-slate-500',
      )}
      style={{ width: geometry.width, height: geometry.height }}
      data-testid={`node-${id}`}
      data-type={component.type}
      data-value={String(signal)}
    >
      <div
        className={cn(
          'flex size-7 items-center justify-center rounded-full font-mono text-sm font-bold transition-all',
          signal === 1 && 'bg-emerald-400 text-slate-900 shadow-[0_0_14px_4px_rgba(52,211,153,0.55)]',
          signal === 0 && 'bg-slate-700 text-slate-400',
          signal === 'X' && 'bg-amber-400/25 text-amber-300 ring-2 ring-amber-400',
        )}
      >
        {signal}
      </div>
      {component.label && (
        <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap text-xs font-medium text-slate-200">
          {component.label}
        </span>
      )}
      <PinHandles nodeId={id} geometry={geometry} />
    </div>
  );
});
