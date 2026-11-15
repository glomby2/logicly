import { Lightbulb, ToggleRight } from 'lucide-react';
import { getComponentPins } from '@/core/circuit';
import type { ElementDefinition } from '@/core/types/element';
import { computeGeometry } from '@/editor/layout/geometry';
import { GateSymbol } from '@/editor/symbols/GateSymbol';
import { GATE_SYMBOLS, nodeKindOf } from '@/editor/symbols/gateShapes';
import { MuxSymbol } from '@/editor/symbols/MuxSymbol';
import { MUX_SYMBOLS } from '@/editor/symbols/muxShapes';
import { SquareWave } from '@/editor/symbols/SquareWave';
import { appStores } from '@/store/hooks';
import { BoxPreview } from './BoxPreview';

const PREVIEW_SCALE = 0.5;
/** Прямоугольные символы крупнее вентилей (100 px в ширину) — уменьшаются сильнее. */
const BOX_PREVIEW_SCALE = 0.3;

/**
 * Миниатюра элемента для палитры: ANSI-символ вентиля, трапеция MUX / DEMUX,
 * значок INPUT / OUTPUT / CLOCK или уменьшенный прямоугольный символ.
 */
export function ElementPreview({ definition }: { definition: ElementDefinition }) {
  const kind = nodeKindOf(definition.type);
  if (kind === 'input') return <ToggleRight className="size-6 text-slate-300" aria-hidden />;
  if (kind === 'output') return <Lightbulb className="size-6 text-slate-300" aria-hidden />;
  if (kind === 'clock') return <SquareWave className="h-5 w-7 text-slate-300" />;

  const pins = getComponentPins(appStores.registry, {
    id: 'preview',
    type: definition.type,
    position: { x: 0, y: 0 },
    props: definition.defaultProps,
  }) ?? { inputs: [], outputs: [] };
  const gate = GATE_SYMBOLS.get(definition.type);
  const mux = MUX_SYMBOLS.get(definition.type);

  if (kind === 'gate' && gate) {
    const geometry = computeGeometry('gate', pins);
    return <GateSymbol symbol={gate} geometry={geometry} output={0} scale={PREVIEW_SCALE} className="overflow-visible" />;
  }
  if (kind === 'mux' && mux) {
    return (
      <MuxSymbol
        orientation={mux}
        geometry={computeGeometry('mux', pins)}
        title={definition.label}
        labels={false}
        scale={PREVIEW_SCALE}
        className="overflow-visible"
      />
    );
  }
  return <BoxPreview geometry={computeGeometry('box', pins)} scale={BOX_PREVIEW_SCALE} />;
}
