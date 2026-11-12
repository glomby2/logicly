import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/cn';
import { appStores } from '@/store/hooks';
import type { ElementNode } from '../adapters/flowMapping';
import { PinHandles } from './PinHandles';

/** INPUT: переключатель 0/1. Клик переключает значение; перетаскивать узел можно за рамку. */
export const InputNode = memo(function InputNode({ id, data, selected }: NodeProps<ElementNode>) {
  const { component, geometry } = data;
  const on = component.props.value === true;

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 rounded-md border-2 bg-slate-800 pl-1.5',
        selected ? 'border-sky-400' : on ? 'border-emerald-400/70' : 'border-slate-500',
      )}
      style={{ width: geometry.width, height: geometry.height }}
      data-testid={`node-${id}`}
      data-type={component.type}
    >
      <button
        type="button"
        className={cn(
          'nodrag nopan flex size-7 shrink-0 items-center justify-center rounded font-mono text-sm font-bold transition-colors',
          on ? 'bg-emerald-400 text-slate-900' : 'bg-slate-600 text-slate-200 hover:bg-slate-500',
        )}
        aria-label={ru.node.toggleInput}
        aria-pressed={on}
        data-testid={`input-toggle-${id}`}
        onClick={() => appStores.commands.toggleInput(id)}
      >
        {on ? 1 : 0}
      </button>
      <span className="truncate text-xs font-medium text-slate-200">{component.label}</span>
      <PinHandles nodeId={id} geometry={geometry} />
    </div>
  );
});
