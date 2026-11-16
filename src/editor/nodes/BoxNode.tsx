import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/cn';
import type { ElementNode } from '../adapters/flowMapping';
import { BOX_TITLE_ROWS, HANDLE_SIZE, PIN_PITCH } from '../layout/geometry';
import { NodeLabel } from './NodeLabel';
import { PinHandles } from './PinHandles';

/** Размер значка ▷ тактового входа, px. */
const CLOCK_MARK = 9;
/** Отступ подписи от края: кружок пина (HANDLE_SIZE / 2) и зазор. */
const LABEL_GAP = HANDLE_SIZE / 2 + 3;

/**
 * Универсальный символ: прямоугольник с названием в верхней полосе и подписями пинов.
 * Подходит для любого нового элемента. Тактовый вход (`PinSpec.clock`) отмечается
 * значком ▷ (динамический вход, IEEE Std 91) сразу за кружком пина.
 * Функциональный блок (`block`: DECODER, ENCODER) — тот же символ; если у элемента есть
 * конфигурация (`variant`, «3:8»), она выводится в центре тела и в `aria-label`.
 */
export const BoxNode = memo(function BoxNode({ id, data, selected }: NodeProps<ElementNode>) {
  const { component, geometry, title, variant } = data;
  return (
    <div
      className={cn(
        'relative rounded-md border-2 bg-slate-800 text-slate-200',
        selected ? 'border-sky-400' : 'border-slate-400',
      )}
      style={{ width: geometry.width, height: geometry.height }}
      {...(variant ? { 'aria-label': `${title} ${variant}` } : {})}
      data-testid={`node-${id}`}
      data-type={component.type}
    >
      <div
        className="absolute inset-x-1 top-0 flex items-center justify-center text-[11px] font-semibold leading-none tracking-wide whitespace-nowrap"
        style={{ height: (BOX_TITLE_ROWS + 0.5) * PIN_PITCH }}
        data-testid="box-title"
      >
        {title}
      </div>
      {variant && (
        <div
          className="pointer-events-none absolute inset-x-0 -translate-y-1/2 text-center text-[10px] leading-none text-slate-400"
          style={{ top: (BOX_TITLE_ROWS * PIN_PITCH + geometry.height) / 2 }}
          data-testid="block-variant"
        >
          {variant}
        </div>
      )}
      {geometry.pins
        .filter((pin) => pin.clock && pin.side === 'left')
        .map((pin) => (
          <svg
            key={pin.id}
            className="pointer-events-none absolute"
            style={{ left: HANDLE_SIZE / 2, top: pin.y - CLOCK_MARK / 2 }}
            width={CLOCK_MARK}
            height={CLOCK_MARK}
            viewBox={`0 0 ${CLOCK_MARK} ${CLOCK_MARK}`}
            data-clock-marker={pin.id}
            aria-hidden
          >
            <path d={`M0.75 0.75 L${CLOCK_MARK - 1} ${CLOCK_MARK / 2} L0.75 ${CLOCK_MARK - 0.75}`} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
          </svg>
        ))}
      {geometry.pins
        .filter((pin) => pin.label)
        .map((pin) => (
          <span
            key={pin.id}
            className="pointer-events-none absolute -translate-y-1/2 text-[10px] text-slate-400"
            style={
              pin.side === 'right'
                ? { right: LABEL_GAP, top: pin.y }
                : pin.side === 'left'
                  ? { left: pin.clock ? HANDLE_SIZE / 2 + CLOCK_MARK + 2 : LABEL_GAP, top: pin.y }
                  : { left: pin.x - 6, top: pin.side === 'top' ? 10 : geometry.height - 10 }
            }
          >
            {pin.label}
          </span>
        ))}
      <NodeLabel text={component.label} />
      <PinHandles nodeId={id} geometry={geometry} />
    </div>
  );
});
