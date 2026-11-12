import { FilePlus, FolderOpen, Save } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { ru } from '@/i18n/ru';
import { selectIsDirty } from '@/store';
import { useCircuitStore } from '@/store/hooks';
import { createNewDocument, openFromDisk, saveToFile } from './fileActions';

/**
 * Кнопки «Новая», «Открыть», «Сохранить» в тулбаре. Точка на «Сохранить» — есть несохранённые
 * изменения. На узком экране «Новая» доступна в разделе «Документ» инспектора.
 */
export function FileControls() {
  const dirty = useCircuitStore(selectIsDirty);
  return (
    <>
      <IconButton label={ru.file.new} icon={FilePlus} onClick={createNewDocument} className="max-sm:hidden" data-testid="file-new" />
      <IconButton label={ru.file.open} icon={FolderOpen} onClick={() => void openFromDisk()} data-testid="file-open" />
      <div className="relative">
        <IconButton
          label={dirty ? `${ru.file.save} — ${ru.file.unsaved.toLowerCase()}` : ru.file.save}
          icon={Save}
          onClick={saveToFile}
          data-testid="file-save"
        />
        {dirty && (
          <span
            className="pointer-events-none absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-400 ring-2 ring-slate-900"
            title={ru.file.unsaved}
            data-testid="unsaved-indicator"
          />
        )}
      </div>
    </>
  );
}
