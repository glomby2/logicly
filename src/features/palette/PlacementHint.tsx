import { MousePointerClick } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { appStores, useUiStore } from '@/store/hooks';

/** Подсказка режима размещения тапом (сенсорные экраны). */
export function PlacementHint() {
  const placement = useUiStore((s) => s.placement);
  if (!placement) return null;
  const title = appStores.registry.get(placement)?.label ?? placement;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-full border border-sky-500/50 bg-slate-900/95 py-1.5 pr-1.5 pl-4 text-sm text-slate-100 shadow-lg"
        data-testid="placement-hint"
      >
        <MousePointerClick className="size-4 text-sky-400" aria-hidden />
        {ru.placement.hint(title)}
        <button
          type="button"
          className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
          onClick={() => appStores.ui.getState().cancelPlacement()}
        >
          {ru.placement.cancel}
        </button>
      </div>
    </div>
  );
}
