import { useEffect } from 'react';
import { appStores } from '@/store/hooks';
import { isEditableTarget, resolveShortcut, type ShortcutAction } from '../shortcuts';

const ACTIONS: Readonly<Record<Exclude<ShortcutAction, 'escape'>, () => void>> = {
  undo: () => appStores.circuit.getState().undo(),
  redo: () => appStores.circuit.getState().redo(),
  copy: () => appStores.commands.copySelection(),
  cut: () => appStores.commands.cutSelection(),
  paste: () => appStores.commands.paste(),
  duplicate: () => appStores.commands.duplicateSelection(),
  selectAll: () => appStores.commands.selectAll(),
  delete: () => appStores.commands.deleteSelection(),
};

/** Горячие клавиши редактора. `onEscape` закрывает меню и снимает выделение. */
export function useKeyboardShortcuts(onEscape: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const action = resolveShortcut(event);
      if (!action) return;
      event.preventDefault();
      if (action === 'escape') onEscape();
      else ACTIONS[action]();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape]);
}
