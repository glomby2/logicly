import type { ElementGeometry } from '@/editor/layout/geometry';
import { SYMBOL_FILL, SYMBOL_STROKE } from '@/editor/symbols/symbolStyle';

/** Длина линии пина за краем корпуса, px (до масштабирования). */
export const BOX_PREVIEW_STUB = 6;
const STUB = BOX_PREVIEW_STUB;
const MARK = 8;

/**
 * Миниатюра универсального прямоугольного символа: корпус, короткие линии пинов
 * и значок ▷ у тактового входа. Подписи не рисуются — в палитре они нечитаемы.
 */
export function BoxPreview({ geometry, scale }: { geometry: ElementGeometry; scale: number }) {
  const { width, height, pins } = geometry;
  const stub = (side: string, x: number, y: number) => {
    switch (side) {
      case 'left':
        return [x - STUB, y, x, y];
      case 'right':
        return [x, y, x + STUB, y];
      case 'top':
        return [x, y - STUB, x, y];
      default:
        return [x, y, x, y + STUB];
    }
  };
  return (
    <svg
      width={(width + 2 * STUB) * scale}
      height={(height + 2 * STUB) * scale}
      viewBox={`${-STUB} ${-STUB} ${width + 2 * STUB} ${height + 2 * STUB}`}
      className="overflow-visible"
      aria-hidden
    >
      <g stroke={SYMBOL_STROKE} strokeWidth={2.5} strokeLinecap="round">
        {pins.map((pin) => {
          const [x1, y1, x2, y2] = stub(pin.side, pin.x, pin.y);
          return <line key={pin.id} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <rect x={0} y={0} width={width} height={height} rx={4} fill={SYMBOL_FILL} stroke={SYMBOL_STROKE} strokeWidth={3} />
      {pins
        .filter((pin) => pin.clock && pin.side === 'left')
        .map((pin) => (
          <path
            key={pin.id}
            d={`M0 ${pin.y - MARK} L${MARK * 1.4} ${pin.y} L0 ${pin.y + MARK}`}
            fill="none"
            stroke={SYMBOL_STROKE}
            strokeWidth={2.5}
          />
        ))}
    </svg>
  );
}
