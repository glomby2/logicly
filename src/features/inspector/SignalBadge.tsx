import type { Signal } from '@/core/logic/signal';
import { cn } from '@/lib/cn';

/** Значение сигнала в виде метки: 1 — зелёная, 0 — серая, X — жёлтая. */
export function SignalBadge({ signal, testId }: { signal: Signal; testId?: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-6 justify-center rounded px-1.5 py-0.5 font-mono text-xs font-bold',
        signal === 1 && 'bg-emerald-400 text-slate-900',
        signal === 0 && 'bg-slate-700 text-slate-300',
        signal === 'X' && 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400',
      )}
      data-testid={testId}
      data-signal={String(signal)}
    >
      {signal}
    </span>
  );
}
