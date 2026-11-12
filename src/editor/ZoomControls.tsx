import { Panel, useReactFlow } from '@xyflow/react';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { ru } from '@/i18n/ru';
import { FIT_VIEW_OPTIONS } from './viewport';

export function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="bottom-left" className="flex flex-col rounded-lg border border-slate-700 bg-slate-900/90 p-1">
      <IconButton label={ru.zoom.zoomIn} icon={ZoomIn} onClick={() => zoomIn({ duration: 150 })} data-testid="zoom-in" />
      <IconButton label={ru.zoom.zoomOut} icon={ZoomOut} onClick={() => zoomOut({ duration: 150 })} data-testid="zoom-out" />
      <IconButton label={ru.zoom.fitView} icon={Maximize} onClick={() => fitView(FIT_VIEW_OPTIONS)} data-testid="fit-view" />
    </Panel>
  );
}
