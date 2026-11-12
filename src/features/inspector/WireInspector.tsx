import { usePinSignal } from '@/editor/hooks/useSignals';
import { ru } from '@/i18n/ru';
import { InspectorSection } from './InspectorSection';
import type { InspectorModel } from './inspectorModel';
import { endpointText } from './inspectorText';
import { SelectionActions } from './SelectionActions';
import { SignalBadge } from './SignalBadge';

type WireModel = Extract<InspectorModel, { kind: 'wire' }>;

export function WireInspector({ model }: { model: WireModel }) {
  const signal = usePinSignal(model.from.componentId, model.from.pinId);
  return (
    <>
      <div className="px-4 pt-4 pb-3 text-lg font-semibold text-slate-100" data-testid="inspector-title">
        {ru.inspector.wire}
      </div>
      <InspectorSection title={ru.inspector.wire}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-slate-500">{ru.inspector.from}</dt>
          <dd className="text-slate-200" data-testid="inspector-wire-from">
            {endpointText(model.from)}
          </dd>
          <dt className="text-slate-500">{ru.inspector.to}</dt>
          <dd className="text-slate-200" data-testid="inspector-wire-to">
            {endpointText(model.to)}
          </dd>
          <dt className="text-slate-500">{ru.inspector.signal}</dt>
          <dd>
            <SignalBadge signal={signal} testId="inspector-wire-signal" />
          </dd>
        </dl>
      </InspectorSection>
      <InspectorSection title={ru.inspector.selected}>
        <SelectionActions canCopy={false} />
      </InspectorSection>
    </>
  );
}
