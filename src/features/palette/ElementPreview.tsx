import { Lightbulb, SquareDashed, ToggleRight } from 'lucide-react';
import { getComponentPins } from '@/core/circuit';
import type { ElementDefinition } from '@/core/types/element';
import { computeGeometry } from '@/editor/layout/geometry';
import { GateSymbol } from '@/editor/symbols/GateSymbol';
import { GATE_SYMBOLS, nodeKindOf } from '@/editor/symbols/gateShapes';
import { appStores } from '@/store/hooks';

/** Миниатюра элемента для палитры: ANSI-символ вентиля или значок. */
export function ElementPreview({ definition }: { definition: ElementDefinition }) {
  const kind = nodeKindOf(definition.type);
  const symbol = GATE_SYMBOLS.get(definition.type);

  if (kind === 'gate' && symbol) {
    const pins = getComponentPins(appStores.registry, {
      id: 'preview',
      type: definition.type,
      position: { x: 0, y: 0 },
      props: definition.defaultProps,
    });
    const geometry = computeGeometry('gate', pins ?? { inputs: [], outputs: [] });
    return <GateSymbol symbol={symbol} geometry={geometry} output={0} scale={0.5} className="overflow-visible" />;
  }

  const Icon = kind === 'input' ? ToggleRight : kind === 'output' ? Lightbulb : SquareDashed;
  return <Icon className="size-6 text-slate-300" aria-hidden />;
}
