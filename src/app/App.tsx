import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Canvas } from '@/editor/Canvas';
import { WIDE_SCREEN } from '@/editor/placement';
import { ShortcutsDialog } from '@/features/help/ShortcutsDialog';
import { Inspector } from '@/features/inspector/Inspector';
import { Notifications } from '@/features/notifications/Notifications';
import { Palette } from '@/features/palette/Palette';
import { PlacementHint } from '@/features/palette/PlacementHint';
import { StatusBar } from '@/features/status/StatusBar';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { appStores, useUiStore } from '@/store/hooks';

export function App() {
  const placing = useUiStore((s) => s.placement !== null);

  useEffect(() => {
    if (window.innerWidth >= WIDE_SCREEN) return;
    appStores.ui.getState().setPanel('palette', false);
    appStores.ui.getState().setPanel('inspector', false);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col bg-slate-950 text-slate-100">
        <Toolbar />
        <div className="relative flex min-h-0 flex-1">
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
      </div>
    </ReactFlowProvider>
  );
}
