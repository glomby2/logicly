import { FilePlus, FolderOpen, Save } from 'lucide-react';
import { ACTION_BUTTON } from '@/components/ui/buttonStyles';
import { InspectorSection } from '@/features/inspector/InspectorSection';
import { ru } from '@/i18n/ru';
import { DocumentName } from './DocumentName';
import { createNewDocument, openFromDisk, saveToFile } from './fileActions';

/** Раздел «Документ» в сводке схемы: название и действия с файлом, в том числе на узком экране. */
export function DocumentSection() {
  return (
    <InspectorSection title={ru.file.document}>
      <DocumentName testId="inspector-document-name" />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" className={ACTION_BUTTON} onClick={createNewDocument} data-testid="inspector-file-new">
          <FilePlus className="size-3.5" aria-hidden />
          {ru.file.new}
        </button>
        <button type="button" className={ACTION_BUTTON} onClick={() => void openFromDisk()} data-testid="inspector-file-open">
          <FolderOpen className="size-3.5" aria-hidden />
          {ru.file.openShort}
        </button>
        <button type="button" className={ACTION_BUTTON} onClick={saveToFile} data-testid="inspector-file-save">
          <Save className="size-3.5" aria-hidden />
          {ru.file.saveShort}
        </button>
      </div>
    </InspectorSection>
  );
}
