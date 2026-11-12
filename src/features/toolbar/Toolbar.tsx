import { CircuitBoard, ClipboardPaste, Copy, Eraser, PanelLeft, Redo2, Trash2, Undo2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Separator } from '@/components/ui/Separator';
import { ru } from '@/i18n/ru';
import { selectCanRedo, selectCanUndo } from '@/store';
import { appStores, useCircuitStore, useUiStore } from '@/store/hooks';

const { circuit, commands, ui } = appStores;

export function Toolbar() {
  const canUndo = useCircuitStore(selectCanUndo);
  const canRedo = useCircuitStore(selectCanRedo);
  const isEmpty = useCircuitStore((s) => s.circuit.components.length === 0);
  const hasSelection = useUiStore((s) => s.selection.components.length + s.selection.wires.length > 0);
  const canPaste = useUiStore((s) => s.clipboard !== null);
  const paletteOpen = useUiStore((s) => s.panels.palette);

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-slate-800 bg-slate-900 px-2">
      <IconButton
        label={ru.toolbar.togglePalette}
        icon={PanelLeft}
        active={paletteOpen}
        onClick={() => ui.getState().togglePanel('palette')}
        data-testid="toggle-palette"
      />
      <div className="mr-2 flex items-center gap-2 pl-1">
        <CircuitBoard className="size-5 text-emerald-400" aria-hidden />
        <h1 className="hidden text-sm font-semibold text-slate-100 sm:block">{ru.app.title}</h1>
      </div>
      <Separator vertical />
      <IconButton label={`${ru.toolbar.undo} (Ctrl+Z)`} icon={Undo2} disabled={!canUndo} onClick={() => circuit.getState().undo()} data-testid="undo" />
      <IconButton label={`${ru.toolbar.redo} (Ctrl+Y)`} icon={Redo2} disabled={!canRedo} onClick={() => circuit.getState().redo()} data-testid="redo" />
      <Separator vertical />
      <IconButton label={`${ru.toolbar.copy} (Ctrl+C)`} icon={Copy} disabled={!hasSelection} onClick={() => commands.copySelection()} />
      <IconButton label={`${ru.toolbar.paste} (Ctrl+V)`} icon={ClipboardPaste} disabled={!canPaste} onClick={() => commands.paste()} />
      <IconButton label={`${ru.toolbar.delete} (Del)`} icon={Trash2} disabled={!hasSelection} onClick={() => commands.deleteSelection()} data-testid="delete" />
      <Separator vertical />
      <IconButton label={ru.toolbar.clear} icon={Eraser} disabled={isEmpty} onClick={() => commands.clearAll()} />
    </header>
  );
}
