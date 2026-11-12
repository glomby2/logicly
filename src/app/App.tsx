import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Canvas } from '@/editor/Canvas';
import { WIDE_SCREEN } from '@/editor/placement';
import { Palette } from '@/features/palette/Palette';
import { StatusBar } from '@/features/status/StatusBar';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { appStores } from '@/store/hooks';

export function App() {
  useEffect(() => {
    if (window.innerWidth < WIDE_SCREEN) appStores.ui.getState().setPanel('palette', false);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col bg-slate-950 text-slate-100">
        <Toolbar />
        <div className="relative flex min-h-0 flex-1">
          <Palette />
          <main className="relative min-w-0 flex-1">
            <Canvas />
          </main>
        </div>
        <StatusBar />
      </div>
    </ReactFlowProvider>
  );
}
