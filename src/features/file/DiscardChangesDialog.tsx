import { Dialog } from '@/components/ui/Dialog';
import { ru } from '@/i18n/ru';
import { appStores, useUiStore } from '@/store/hooks';
import { discardAndContinue } from './fileActions';

/** Подтверждение перед заменой изменённого документа (новая схема или открытие файла). */
export function DiscardChangesDialog() {
  const open = useUiStore((s) => s.dialog === 'discard-changes');
  if (!open) return null;
  const cancel = () => appStores.commands.cancelPendingDocument();

  return (
    <Dialog title={ru.file.discard.title} closeLabel={ru.file.discard.cancel} onClose={cancel} testId="discard-dialog">
      <p className="text-sm text-slate-300">{ru.file.discard.text}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-500"
          onClick={cancel}
          data-testid="discard-cancel"
        >
          {ru.file.discard.cancel}
        </button>
        <button
          type="button"
          className="rounded-md border border-rose-800 bg-rose-950/50 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-900/50 focus-visible:outline-2 focus-visible:outline-sky-500"
          onClick={discardAndContinue}
          data-testid="discard-confirm"
        >
          {ru.file.discard.confirm}
        </button>
      </div>
    </Dialog>
  );
}
