import { useEffect } from 'react';
import { isEditableTarget, isFileShortcut, resolveShortcut } from '@/editor/shortcuts';
import { appStores } from '@/store/hooks';
import { openFromDisk, saveToFile } from './fileActions';

/**
 * Ctrl+S — сохранить, Ctrl+O — открыть (по `event.code`, в любой раскладке).
 * Работают и в поле ввода: черновик поля сначала применяется (blur), затем выполняется действие.
 * Пока открыт диалог, действия не выполняются, но системный диалог браузера всё равно подавляется.
 */
export function useFileShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const action = resolveShortcut(event);
      if (!isFileShortcut(action)) return;
      event.preventDefault();
      if (event.repeat || appStores.ui.getState().dialog !== null) return;
      if (isEditableTarget(event.target)) (event.target as HTMLElement).blur();
      if (action === 'save') saveToFile();
      else void openFromDisk();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
