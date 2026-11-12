import { useReactFlow } from '@xyflow/react';
import { AlertTriangle, CheckCircle2, LocateFixed, Unplug } from 'lucide-react';
import { DocumentSection } from '@/features/file/DocumentSection';
import { ru } from '@/i18n/ru';
import { appStores } from '@/store/hooks';
import { InspectorSection } from './InspectorSection';
import type { InspectorModel } from './inspectorModel';
import { endpointText } from './inspectorText';

type CircuitModel = Extract<InspectorModel, { kind: 'circuit' }>;

/** Выделяет элемент и сдвигает к нему поле, сохраняя текущий масштаб. */
function useShowComponent() {
  const { getInternalNode, getZoom, setCenter } = useReactFlow();
  return (componentId: string) => {
    appStores.ui.getState().select({ components: [componentId] });
    const node = getInternalNode(componentId);
    if (!node) return;
    const { x, y } = node.internals.positionAbsolute;
    void setCenter(x + (node.measured.width ?? 0) / 2, y + (node.measured.height ?? 0) / 2, {
      zoom: getZoom(),
      duration: 250,
    });
  };
}

export function CircuitSummary({ model }: { model: CircuitModel }) {
  const show = useShowComponent();

  if (model.components === 0) {
    return (
      <>
        <DocumentSection />
        <p className="border-t border-slate-800 px-4 py-4 text-sm text-slate-400">{ru.inspector.empty}</p>
      </>
    );
  }

  return (
    <>
      <div className="px-4 pt-4 pb-3 text-lg font-semibold text-slate-100" data-testid="inspector-title">
        {ru.inspector.circuit}
      </div>
      <DocumentSection />
      <InspectorSection title={ru.inspector.circuit}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-slate-500">{ru.inspector.elements}</dt>
          <dd className="text-slate-200">{model.components}</dd>
          <dt className="text-slate-500">{ru.inspector.wires}</dt>
          <dd className="text-slate-200">{model.wires}</dd>
        </dl>
      </InspectorSection>
      <InspectorSection title={ru.inspector.issues}>
        {model.issues.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckCircle2 className="size-4" aria-hidden />
            {ru.inspector.noIssues}
          </p>
        ) : (
          <ul className="space-y-1" data-testid="inspector-issues">
            {model.issues.map((issue) => {
              const Icon = issue.kind === 'unknown' ? AlertTriangle : Unplug;
              return (
                <li key={`${issue.kind}:${issue.endpoint.componentId}:${issue.endpoint.pinId}`}>
                  <button
                    type="button"
                    onClick={() => show(issue.endpoint.componentId)}
                    title={ru.inspector.show}
                    className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-800"
                    data-testid="inspector-issue"
                  >
                    <Icon
                      className={issue.kind === 'unknown' ? 'mt-0.5 size-4 text-amber-400' : 'mt-0.5 size-4 text-slate-500'}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-200">{endpointText(issue.endpoint)}</span>
                      <span className="block text-xs text-slate-500">
                        {issue.kind === 'unknown' ? ru.inspector.issueUnknown : ru.inspector.issueFloating}
                      </span>
                    </span>
                    <LocateFixed className="mt-0.5 size-4 text-slate-600 group-hover:text-sky-400" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </InspectorSection>
    </>
  );
}
