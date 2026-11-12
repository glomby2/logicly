import { useEffect } from 'react';
import { selectIsDirty } from '@/store';
import { useCircuitStore } from '@/store/hooks';

/** Пока есть несохранённые изменения, браузер спрашивает подтверждение при закрытии или перезагрузке вкладки. */
export function useUnsavedChangesGuard() {
  const dirty = useCircuitStore(selectIsDirty);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Устаревший способ, нужен части браузеров для показа диалога.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
