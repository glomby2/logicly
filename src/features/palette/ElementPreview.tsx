import { Lightbulb, SquareDashed, ToggleRight } from 'lucide-react';
import { getComponentPins } from '@/core/circuit';
import type { ElementDefinition } from '@/core/types/element';
import { computeGeometry } from '@/editor/layout/geometry';
import { GateSymbol } from '@/editor/symbols/GateSymbol';
import { GATE_SYMBOLS, nodeKindOf } from '@/editor/symbols/gateShapes';
import { MuxSymbol } from '@/editor/symbols/MuxSymbol';
import { MUX_SYMBOLS } from '@/editor/symbols/muxShapes';
import { appStores } from '@/store/hooks';

const PREVIEW_SCALE = 0.5;

/** Миниатюра элемента для палитры: ANSI-символ вентиля, трапеция MUX / DEMUX или значок. */
export function ElementPreview({ definition }: { definition: ElementDefinition }) {
  const kind = nodeKindOf(definition.type);
  const gate = GATE_SYMBOLS.get(definition.type);
  const mux = MUX_SYMBOLS.get(definition.type);

  if ((kind === 'gate' && gate) || (kind === 'mux' && mux)) {
    const pins = getComponentPins(appStores.registry, {
      id: 'preview',
      type: definition.type,
      position: { x: 0, y: 0 },
      props: definition.defaultProps,
    }) ?? { inputs: [], outputs: [] };
    const geometry = computeGeometry(kind, pins);
    return gate ? (
      <GateSymbol symbol={gate} geometry={geometry} output={0} scale={PREVIEW_SCALE} className="overflow-visible" />
    ) : (
      <MuxSymbol
        orientation={mux!}
        geometry={geometry}
        title={definition.label}
        labels={false}
        scale={PREVIEW_SCALE}
        className="overflow-visible"
      />
    );
  }

  const Icon = kind === 'input' ? ToggleRight : kind === 'output' ? Lightbulb : SquareDashed;
  return <Icon className="size-6 text-slate-300" aria-hidden />;
}
