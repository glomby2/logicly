import {
  CircleHelp,
  CircuitBoard,
  ClipboardPaste,
  Copy,
  Eraser,
  PanelLeft,
  PanelRight,
  Redo2,
  Table2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { DocumentName } from '@/features/file/DocumentName';
import { FileControls } from '@/features/file/FileControls';
import { SimulationControls } from '@/features/simulation/SimulationControls';
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
  const inspectorOpen = useUiStore((s) => s.panels.inspector);

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900 px-2">
      <IconButton
        label={ru.toolbar.togglePalette}
        icon={PanelLeft}
        active={paletteOpen}
        onClick={() => ui.getState().togglePanel('palette')}
        data-testid="toggle-palette"
      />
      {/* На узком экране логотип скрыт, чтобы поместились кнопки файла; название — в инспекторе. */}
      <div className="mr-2 flex items-center gap-2 pl-1 max-sm:hidden">
        <CircuitBoard className="size-5 text-emerald-400" aria-hidden />
        <h1 className="hidden text-sm font-semibold text-slate-100 xl:block">{ru.app.title}</h1>
      </div>
      <div className="w-44 shrink-0 max-md:hidden lg:w-56">
        <DocumentName testId="document-name" />
      </div>
      <Separator vertical className="max-sm:hidden" />
      <FileControls />
      <Separator vertical />
      <IconButton label={`${ru.toolbar.undo} (Ctrl+Z)`} icon={Undo2} disabled={!canUndo} onClick={() => circuit.getState().undo()} data-testid="undo" />
      <IconButton label={`${ru.toolbar.redo} (Ctrl+Y)`} icon={Redo2} disabled={!canRedo} onClick={() => circuit.getState().redo()} data-testid="redo" />
      <Separator vertical />
      {/* На узком экране копирование и вставка доступны в инспекторе и контекстном меню. */}
      <IconButton label={`${ru.toolbar.copy} (Ctrl+C)`} icon={Copy} disabled={!hasSelection} onClick={() => commands.copySelection()} className="max-sm:hidden" />
      <IconButton label={`${ru.toolbar.paste} (Ctrl+V)`} icon={ClipboardPaste} disabled={!canPaste} onClick={() => commands.paste()} className="max-sm:hidden" />
      <IconButton label={`${ru.toolbar.delete} (Del)`} icon={Trash2} disabled={!hasSelection} onClick={() => commands.deleteSelection()} data-testid="delete" />
      <Separator vertical className="hidden sm:block" />
      <IconButton label={ru.toolbar.clear} icon={Eraser} disabled={isEmpty} onClick={() => commands.clearAll()} className="max-sm:hidden" />
      {/* На узком экране таблица истинности открывается из инспектора. */}
      <IconButton
        label={ru.truthTable.open}
        icon={Table2}
        disabled={isEmpty}
        onClick={() => ui.getState().openDialog('truth-table')}
        className="max-sm:hidden"
        data-testid="open-truth-table"
      />
      <div className="ml-auto flex items-center gap-1">
        <SimulationControls />
        <Separator vertical />
        <IconButton
          label={ru.help.open}
          icon={CircleHelp}
          onClick={() => ui.getState().openDialog('shortcuts')}
          className="max-sm:hidden"
          data-testid="open-help"
        />
        <IconButton
          label={ru.inspector.toggle}
          icon={PanelRight}
          active={inspectorOpen}
          onClick={() => ui.getState().togglePanel('inspector')}
          data-testid="toggle-inspector"
        />
      </div>
    </header>
  );
}
