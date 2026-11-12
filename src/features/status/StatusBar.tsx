import { AlertTriangle, CheckCircle2, Unplug } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { useCircuitStore, useSimulationStore } from '@/store/hooks';

export function StatusBar() {
  const components = useCircuitStore((s) => s.circuit.components.length);
  const wires = useCircuitStore((s) => s.circuit.wires.length);
  const unknown = useSimulationStore((s) => s.unknownNets.length);
  const floating = useSimulationStore((s) => s.floatingInputs.size);
  const compilations = useSimulationStore((s) => s.compilations);

  return (
    <footer
      className="flex h-8 shrink-0 items-center gap-4 overflow-x-auto whitespace-nowrap border-t border-slate-800 bg-slate-900 px-3 text-xs text-slate-400"
      data-testid="status-bar"
      data-compilations={compilations}
    >
      {components === 0 ? (
        <span>{ru.status.empty}</span>
      ) : (
        <>
          <span>
            {ru.status.components}: <b className="text-slate-200">{components}</b>
          </span>
          <span>
            {ru.status.wires}: <b className="text-slate-200">{wires}</b>
          </span>
          {unknown > 0 ? (
            <span className="flex items-center gap-1 text-amber-300" data-testid="status-unknown">
              <AlertTriangle className="size-3.5" aria-hidden />
              {ru.status.oscillation}. {ru.status.unknown(unknown)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {ru.status.stable}
            </span>
          )}
          {floating > 0 && (
            <span className="flex items-center gap-1">
              <Unplug className="size-3.5" aria-hidden />
              {ru.status.floating(floating)}
            </span>
          )}
        </>
      )}
    </footer>
  );
}
