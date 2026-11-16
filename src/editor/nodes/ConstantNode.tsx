import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/cn';
import type { ElementNode } from '../adapters/flowMapping';
import { usePinSignal } from '../hooks/useSignals';
import { NodeLabel } from './NodeLabel';
import { PinHandles } from './PinHandles';

/**
 * CONSTANT: постоянный уровень 0 или 1 (`variant`). Это не переключатель: по клику
 * не меняется, уровень задаётся свойством в инспекторе или контекстном меню.
 */
export const ConstantNode = memo(function ConstantNode({ id, data, selected }: NodeProps<ElementNode>) {
  const { component, geometry, title, variant } = data;
  const outputPin = geometry.pins.find((pin) => pin.direction === 'output');
  const signal = usePinSignal(id, outputPin?.id ?? '');
  const high = variant === '1';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-md border-2 bg-slate-800',
        selected ? 'border-sky-400' : high ? 'border-emerald-400/70' : 'border-slate-500',
      )}
      style={{ width: geometry.width, height: geometry.height }}
      aria-label={variant ? `${title} ${variant}` : title}
      data-testid={`node-${id}`}
      data-type={component.type}
      data-value={String(signal)}
    >
      <span className={cn('font-mono text-base font-bold', high ? 'text-emerald-300' : 'text-slate-300')}>{variant}</span>
      <NodeLabel text={component.label} />
      <PinHandles nodeId={id} geometry={geometry} />
    </div>
  );
});
