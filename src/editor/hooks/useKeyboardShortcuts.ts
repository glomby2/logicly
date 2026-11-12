import { useEffect } from 'react';
import { appStores } from '@/store/hooks';
import { isEditableTarget, resolveNudge, resolveShortcut, type ShortcutAction } from '../shortcuts';

const ACTIONS: Readonly<Record<Exclude<ShortcutAction, 'escape'>, () => void>> = {
  undo: () => appStores.circuit.getState().undo(),
  redo: () => appStores.circuit.getState().redo(),
  copy: () => appStores.commands.copySelection(),
  cut: () => appStores.commands.cutSelection(),
  paste: () => appStores.commands.paste(),
  duplicate: () => appStores.commands.duplicateSelection(),
  selectAll: () => appStores.commands.selectAll(),
  delete: () => appStores.commands.deleteSelection(),
  help: () => appStores.ui.getState().openDialog('shortcuts'),
};

/**
 * Горячие клавиши редактора. Пока открыт диалог, работает только Esc (закрывает диалог).
 * `onEscape` закрывает меню, режим размещения и снимает выделение.
 */
export function useKeyboardShortcuts(onEscape: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const action = resolveShortcut(event);
      const dialogOpen = appStores.ui.getState().dialog !== null;

      if (dialogOpen) {
        if (action === 'escape') {
          event.preventDefault();
          appStores.ui.getState().closeDialog();
        }
        return;
      }

      const nudge = resolveNudge(event);
      if (nudge) {
        if (appStores.ui.getState().selection.components.length === 0) return;
        event.preventDefault();
        appStores.commands.nudgeSelection(nudge.dx, nudge.dy);
        return;
      }

      if (!action) return;
      event.preventDefault();
      if (action === 'escape') onEscape();
      else ACTIONS[action]();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape]);
}
