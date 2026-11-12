import { useEffect } from 'react';
import { ru } from '@/i18n/ru';
import { selectIsDirty } from '@/store';
import { useCircuitStore } from '@/store/hooks';

/** Заголовок вкладки: «● Название — Логический симулятор»; точка — есть несохранённые изменения. */
export function documentTitle(name: string, dirty: boolean): string {
  return `${dirty ? '● ' : ''}${name || ru.file.untitled} — ${ru.app.title}`;
}

export function useDocumentTitle() {
  const name = useCircuitStore((s) => s.name);
  const dirty = useCircuitStore(selectIsDirty);
  useEffect(() => {
    document.title = documentTitle(name, dirty);
  }, [name, dirty]);
}
