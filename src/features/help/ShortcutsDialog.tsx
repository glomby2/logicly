import { Dialog } from '@/components/ui/Dialog';
import { ru } from '@/i18n/ru';
import { appStores, useUiStore } from '@/store/hooks';

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.dialog === 'shortcuts');
  if (!open) return null;

  return (
    <Dialog
      title={ru.help.title}
      closeLabel={ru.help.close}
      onClose={() => appStores.ui.getState().closeDialog()}
      testId="shortcuts-dialog"
    >
      <div className="space-y-5">
        {ru.help.groups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.title}</h3>
            <dl className="grid grid-cols-[minmax(0,11rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
              {group.items.map(([keys, action]) => (
                <div key={keys} className="contents">
                  <dt>
                    <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-sans text-xs text-slate-200">
                      {keys}
                    </kbd>
                  </dt>
                  <dd className="text-slate-300">{action}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
