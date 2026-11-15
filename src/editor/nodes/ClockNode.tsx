import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/cn';
import type { ElementNode } from '../adapters/flowMapping';
import { usePinSignal } from '../hooks/useSignals';
import { SquareWave } from '../symbols/SquareWave';
import { PinHandles } from './PinHandles';

/**
 * CLOCK: генератор тактов. Уровень меняют шаги симуляции (Старт / Шаг), поэтому
 * по клику узел не переключается — показывает меандр и текущий уровень.
 */
export const ClockNode = memo(function ClockNode({ id, data, selected }: NodeProps<ElementNode>) {
  const { component, geometry, title } = data;
  const outputPin = geometry.pins.find((pin) => pin.direction === 'output');
  const level = usePinSignal(id, outputPin?.id ?? '');

  return (
    <div
      className={cn(
        'relative flex items-center gap-1.5 rounded-md border-2 bg-slate-800 pl-1.5',
        selected ? 'border-sky-400' : level === 1 ? 'border-emerald-400/70' : 'border-slate-500',
      )}
      style={{ width: geometry.width, height: geometry.height }}
      aria-label={title}
      data-testid={`node-${id}`}
      data-type={component.type}
      data-value={String(level)}
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded transition-colors',
          level === 1 ? 'bg-emerald-400 text-slate-900' : 'bg-slate-600 text-slate-200',
        )}
      >
        <SquareWave className="h-4 w-5" />
      </div>
      <span className="truncate font-mono text-xs font-bold text-slate-200" data-testid={`clock-level-${id}`}>
        {level}
      </span>
      {component.label && (
        <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap text-xs font-medium text-slate-300">
          {component.label}
        </span>
      )}
      <PinHandles nodeId={id} geometry={geometry} />
    </div>
  );
});
