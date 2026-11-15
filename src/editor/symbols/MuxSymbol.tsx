import { HANDLE_SIZE, type ElementGeometry, type PinGeometry } from '../layout/geometry';
import { muxBodyPath, muxBottomEdgeY, muxRatio, type MuxOrientation } from './muxShapes';
import { SELECTED_FILTER, SYMBOL_FILL, SYMBOL_STROKE } from './symbolStyle';

interface MuxSymbolProps {
  readonly orientation: MuxOrientation;
  readonly geometry: Pick<ElementGeometry, 'width' | 'height' | 'pins'>;
  /** Название типа: MUX, DEMUX. */
  readonly title: string;
  readonly selected?: boolean;
  /** Масштаб отображения (превью в палитре). */
  readonly scale?: number;
  /** Название, конфигурация и подписи пинов; в палитре не нужны. */
  readonly labels?: boolean;
  readonly className?: string;
}

const TITLE_COLOR = '#e2e8f0';
const PIN_LABEL_COLOR = '#94a3b8';
/** Отступ подписи от края корпуса: кружок пина (HANDLE_SIZE / 2) и зазор. */
const LABEL_GAP = HANDLE_SIZE / 2 + 3;

function PinLabel({ pin, edgeY }: { pin: PinGeometry; edgeY: number }) {
  const common = { fill: PIN_LABEL_COLOR, fontSize: 9, dominantBaseline: 'central' as const };
  switch (pin.side) {
    case 'left':
      return <text x={LABEL_GAP} y={pin.y} textAnchor="start" {...common}>{pin.label}</text>;
    case 'right':
      return <text x={pin.x - LABEL_GAP} y={pin.y} textAnchor="end" {...common}>{pin.label}</text>;
    default:
      return <text x={pin.x} y={edgeY - 7} textAnchor="middle" {...common}>{pin.label}</text>;
  }
}

/**
 * Трапеция MUX / DEMUX: корпус по границам узла, линии входов выбора от нижнего края узла
 * до наклонной стороны, название с конфигурацией (MUX 4:1) и подписи пинов внутри.
 */
export function MuxSymbol({
  orientation,
  geometry,
  title,
  selected = false,
  scale = 1,
  labels = true,
  className = 'absolute inset-0 overflow-visible',
}: MuxSymbolProps) {
  const { width, height, pins } = geometry;
  const bottom = pins.filter((pin) => pin.side === 'bottom');
  const edgeY = (pin: PinGeometry) => muxBottomEdgeY(orientation, width, height, pin.x);

  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={selected ? { filter: SELECTED_FILTER } : undefined}
      aria-hidden
    >
      <g stroke={SYMBOL_STROKE} strokeWidth={2} strokeLinecap="round">
        {bottom.map((pin) => (
          <line key={pin.id} x1={pin.x} y1={height} x2={pin.x} y2={edgeY(pin)} data-select-line={pin.id} />
        ))}
      </g>
      <path
        d={muxBodyPath(orientation, width, height)}
        fill={SYMBOL_FILL}
        stroke={SYMBOL_STROKE}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {labels && (
        <g fontFamily="inherit">
          <text
            x={width / 2}
            y={height / 2 - 8}
            textAnchor="middle"
            dominantBaseline="central"
            fill={TITLE_COLOR}
            fontSize={10}
            fontWeight={600}
            letterSpacing={0.5}
          >
            {title}
          </text>
          <text
            x={width / 2}
            y={height / 2 + 3}
            textAnchor="middle"
            dominantBaseline="central"
            fill={PIN_LABEL_COLOR}
            fontSize={9}
            data-testid="mux-ratio"
          >
            {muxRatio(geometry)}
          </text>
          {pins
            .filter((pin) => pin.label)
            .map((pin) => (
              <PinLabel key={pin.id} pin={pin} edgeY={edgeY(pin)} />
            ))}
        </g>
      )}
    </svg>
  );
}
