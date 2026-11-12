import { ComponentLabelField, ComponentPropField } from '@/editor/ComponentFields';
import { usePinSignal } from '@/editor/hooks/useSignals';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/cn';
import { appStores } from '@/store/hooks';
import { InspectorSection } from './InspectorSection';
import type { InspectorModel, PinRow } from './inspectorModel';
import { SelectionActions } from './SelectionActions';
import { SignalBadge } from './SignalBadge';

type ComponentModel = Extract<InspectorModel, { kind: 'component' }>;

function PinItem({ componentId, pin }: { componentId: string; pin: PinRow }) {
  const signal = usePinSignal(componentId, pin.id);
  const name = pin.label ?? (pin.direction === 'input' ? ru.inspector.input(pin.index) : ru.inspector.output(pin.index));
  return (
    <li className="flex items-center justify-between gap-2 py-1 text-sm" data-testid={`inspector-pin-${pin.id}`}>
      <span className={cn('text-slate-300', !pin.connected && 'text-slate-500')}>
        {name}
        {!pin.connected && <span className="ml-1.5 text-xs italic">— {ru.inspector.notConnected}</span>}
      </span>
      <SignalBadge signal={signal} />
    </li>
  );
}

function ToggleRow({ componentId, on }: { componentId: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm text-slate-200">
      {ru.inspector.value}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={ru.node.toggleInput}
        onClick={() => appStores.commands.toggleInput(componentId)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-sky-500',
          on ? 'bg-emerald-500' : 'bg-slate-700',
        )}
        data-testid="inspector-toggle"
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform',
            on && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}

export function ComponentInspector({ model }: { model: ComponentModel }) {
  const { component } = model;
  return (
    <>
      <div className="px-4 pt-4 pb-3">
        <div className="text-lg font-semibold text-slate-100" data-testid="inspector-title">
          {model.title}
        </div>
        <p className="mt-1 text-xs leading-snug text-slate-400">{model.description}</p>
      </div>
      <InspectorSection title={ru.inspector.label}>
        <ComponentLabelField componentId={component.id} testId="inspector-label" />
      </InspectorSection>
      {(model.toggle || model.props.length > 0) && (
        <InspectorSection title={ru.inspector.properties}>
          <div className="space-y-2">
            {model.toggle && <ToggleRow componentId={component.id} on={component.props.value === true} />}
            {model.props.map((spec) => (
              <ComponentPropField key={spec.key} componentId={component.id} spec={spec} />
            ))}
          </div>
        </InspectorSection>
      )}
      {model.pins.length > 0 && (
        <InspectorSection title={ru.inspector.pins}>
          <ul>
            {model.pins.map((pin) => (
              <PinItem key={pin.id} componentId={component.id} pin={pin} />
            ))}
          </ul>
        </InspectorSection>
      )}
      <InspectorSection title={ru.inspector.selected}>
        <SelectionActions />
      </InspectorSection>
    </>
  );
}
