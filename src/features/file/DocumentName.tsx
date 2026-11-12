import { TextField } from '@/components/ui/TextField';
import { MAX_DOCUMENT_NAME_LENGTH } from '@/core/serialization';
import { ru } from '@/i18n/ru';
import { appStores, useCircuitStore } from '@/store/hooks';

/** Поле названия документа. Изменение применяется по Enter или при уходе из поля, Esc отменяет. */
export function DocumentName({ className, testId }: { className?: string; testId?: string }) {
  const name = useCircuitStore((s) => s.name);
  return (
    <TextField
      // key: при загрузке другого документа черновик поля начинается с нового названия.
      key={name}
      value={name}
      onCommit={(value) => appStores.commands.renameDocument(value)}
      placeholder={ru.file.untitled}
      aria-label={ru.file.name}
      title={ru.file.name}
      maxLength={MAX_DOCUMENT_NAME_LENGTH}
      spellCheck={false}
      className={className}
      data-testid={testId}
    />
  );
}
