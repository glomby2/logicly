import { X } from 'lucide-react';
import { useMemo } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/cn';
import { appStores, useCircuitStore, useSimulationStore, useUiStore } from '@/store/hooks';
import { CircuitSummary } from './CircuitSummary';
import { ComponentInspector } from './ComponentInspector';
import { InspectorSection } from './InspectorSection';
import { buildInspectorModel, type InspectorModel } from './inspectorModel';
import { SelectionActions } from './SelectionActions';
import { WireInspector } from './WireInspector';

function MultipleInspector({ model }: { model: Extract<InspectorModel, { kind: 'multiple' }> }) {
  return (
    <>
      <div className="px-4 pt-4 pb-3 text-lg font-semibold text-slate-100" data-testid="inspector-title">
        {ru.inspector.selected}: {model.components + model.wires}
      </div>
      <InspectorSection title={ru.inspector.selected}>
        <ul className="space-y-1 text-sm">
          {model.byType.map((item) => (
            <li key={item.type} className="flex justify-between text-slate-300">
              {item.title}
              <span className="font-mono text-slate-400">{item.count}</span>
            </li>
          ))}
          {model.wires > 0 && (
            <li className="flex justify-between text-slate-300">
              {ru.inspector.wires}
              <span className="font-mono text-slate-400">{model.wires}</span>
            </li>
          )}
        </ul>
      </InspectorSection>
      <InspectorSection title={ru.inspector.selected}>
        <SelectionActions canCopy={model.components > 0} />
      </InspectorSection>
    </>
  );
}

function InspectorBody() {
  const circuit = useCircuitStore((s) => s.circuit);
  const selection = useUiStore((s) => s.selection);
  const floatingInputs = useSimulationStore((s) => s.floatingInputs);
  const unknownNets = useSimulationStore((s) => s.unknownNets);
  const model = useMemo(
    () => buildInspectorModel({ circuit, selection, registry: appStores.registry, floatingInputs, unknownNets }),
    [circuit, selection, floatingInputs, unknownNets],
  );

  switch (model.kind) {
    case 'component':
      // key: при выборе другого элемента поля редактирования начинают с его значений.
      return <ComponentInspector key={model.component.id} model={model} />;
    case 'wire':
      return <WireInspector model={model} />;
    case 'multiple':
      return <MultipleInspector model={model} />;
    case 'circuit':
      return <CircuitSummary model={model} />;
  }
}

/**
 * Панель свойств выделенного. Справа на широком экране, выдвижная — на узком.
 * Не трогает вид рабочего поля: поле остаётся смонтированным, меняется только его ширина.
 */
export function Inspector() {
  const open = useUiStore((s) => s.panels.inspector);
  return (
    <aside
      className={cn(
        'z-20 flex w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-slate-900',
        'absolute inset-y-0 right-0 transition-transform md:static md:translate-x-0',
        open ? 'translate-x-0' : 'translate-x-full md:hidden',
      )}
      aria-label={ru.inspector.title}
      data-testid="inspector"
    >
      <div className="flex items-center justify-between border-b border-slate-800 py-1 pr-1 pl-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ru.inspector.title}</h2>
        <IconButton
          label={ru.inspector.close}
          icon={X}
          className="md:hidden"
          onClick={() => appStores.ui.getState().setPanel('inspector', false)}
        />
      </div>
      <InspectorBody />
    </aside>
  );
}
