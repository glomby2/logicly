import { Lightbulb, ToggleRight } from 'lucide-react';
import { getComponentPins } from '@/core/circuit';
import type { ElementDefinition } from '@/core/types/element';
import { computeGeometry } from '@/editor/layout/geometry';
import { blockWidth } from '@/editor/symbols/blockShapes';
import { GateSymbol } from '@/editor/symbols/GateSymbol';
import { GATE_SYMBOLS, nodeKindOf } from '@/editor/symbols/gateShapes';
import { MuxSymbol } from '@/editor/symbols/MuxSymbol';
import { MUX_SYMBOLS } from '@/editor/symbols/muxShapes';
import { SquareWave } from '@/editor/symbols/SquareWave';
import { appStores } from '@/store/hooks';
import { BoxPreview, BOX_PREVIEW_STUB } from './BoxPreview';

const PREVIEW_SCALE = 0.5;
/** Прямоугольные символы крупнее вентилей (100 px в ширину) — уменьшаются сильнее. */
const BOX_PREVIEW_SCALE = 0.3;
/** Высота области превью в плитке палитры (`h-8`), px. Высокий блок уменьшается, чтобы поместиться. */
const PREVIEW_MAX_HEIGHT = 32;

/**
 * Миниатюра элемента для палитры: ANSI-символ вентиля, трапеция MUX / DEMUX,
 * значок INPUT / OUTPUT / CLOCK / CONSTANT или уменьшенный прямоугольный символ.
 */
export function ElementPreview({ definition }: { definition: ElementDefinition }) {
  const kind = nodeKindOf(definition.type);
  if (kind === 'input') return <ToggleRight className="size-6 text-slate-300" aria-hidden />;
  if (kind === 'output') return <Lightbulb className="size-6 text-slate-300" aria-hidden />;
  if (kind === 'clock') return <SquareWave className="h-5 w-7 text-slate-300" />;
  if (kind === 'constant') {
    return (
      <span
        className="flex size-6 items-center justify-center rounded border-2 border-slate-400 font-mono text-xs font-bold text-slate-200"
        aria-hidden
      >
        {definition.variant?.(definition.defaultProps) ?? ''}
      </span>
    );
  }

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
  if (kind === 'block') {
    const geometry = computeGeometry('block', pins, { width: blockWidth(definition.type) });
    const scale = Math.min(BOX_PREVIEW_SCALE, PREVIEW_MAX_HEIGHT / (geometry.height + 2 * BOX_PREVIEW_STUB));
    return <BoxPreview geometry={geometry} scale={scale} />;
  }
  return <BoxPreview geometry={computeGeometry('box', pins)} scale={BOX_PREVIEW_SCALE} />;
}
