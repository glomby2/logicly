import { Copy, CopyPlus, Trash2 } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { appStores } from '@/store/hooks';

const BUTTON =
  'flex min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-slate-700 px-1 py-1.5 ' +
  'text-[11px] text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-500';

/** Действия над выделенным. Удаление доступно без клавиатуры — важно для сенсорных экранов. */
export function SelectionActions({ canCopy = true }: { canCopy?: boolean }) {
  const { commands } = appStores;
  return (
    <div className="grid grid-cols-3 gap-2">
      {canCopy && (
        <>
          <button type="button" className={BUTTON} onClick={() => commands.copySelection()}>
            <Copy className="size-3.5" aria-hidden />
            {ru.inspector.copy}
          </button>
          <button type="button" className={BUTTON} onClick={() => commands.duplicateSelection()}>
            <CopyPlus className="size-3.5" aria-hidden />
            {ru.inspector.duplicate}
          </button>
        </>
      )}
      <button
        type="button"
        className={`${BUTTON} border-rose-900/70 text-rose-300 hover:bg-rose-950/40`}
        onClick={() => commands.deleteSelection()}
        data-testid="inspector-delete"
      >
        <Trash2 className="size-3.5" aria-hidden />
        {ru.inspector.delete}
      </button>
    </div>
  );
}
