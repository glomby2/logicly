import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Canvas } from '@/editor/Canvas';
import { WIDE_SCREEN } from '@/editor/placement';
import { DiscardChangesDialog } from '@/features/file/DiscardChangesDialog';
import { useDocumentTitle } from '@/features/file/useDocumentTitle';
import { useFileShortcuts } from '@/features/file/useFileShortcuts';
import { useUnsavedChangesGuard } from '@/features/file/useUnsavedChangesGuard';
import { ShortcutsDialog } from '@/features/help/ShortcutsDialog';
import { Inspector } from '@/features/inspector/Inspector';
import { Notifications } from '@/features/notifications/Notifications';
import { Palette } from '@/features/palette/Palette';
import { PlacementHint } from '@/features/palette/PlacementHint';
import { StatusBar } from '@/features/status/StatusBar';
import { TruthTableDialog } from '@/features/truthTable/TruthTableDialog';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { appStores, useUiStore } from '@/store/hooks';

export function App() {
  const placing = useUiStore((s) => s.placement !== null);
  useFileShortcuts();
  useUnsavedChangesGuard();
  useDocumentTitle();

  useEffect(() => {
    if (window.innerWidth >= WIDE_SCREEN) return;
    appStores.ui.getState().setPanel('palette', false);
    appStores.ui.getState().setPanel('inspector', false);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col bg-slate-950 text-slate-100">
        <Toolbar />
        {/*
          overflow-hidden: закрытые выдвижные панели (палитра, инспектор) сдвинуты за край
          и не должны увеличивать ширину документа. Меню, диалоги и уведомления — fixed,
          у контейнера нет transform, поэтому они не обрезаются.
        */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden" data-testid="workspace">
          <Palette />
          <main className="relative min-w-0 flex-1" data-placing={placing || undefined}>
            <Canvas />
            <PlacementHint />
          </main>
          <Inspector />
        </div>
        <StatusBar />
        <Notifications />
        <ShortcutsDialog />
        <DiscardChangesDialog />
        <TruthTableDialog />
      </div>
    </ReactFlowProvider>
  );
}
