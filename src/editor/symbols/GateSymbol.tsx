import type { Signal } from '@/core/logic/signal';
import type { ElementGeometry } from '../layout/geometry';
import { signalColor } from '../signalStyle';
import {
  backEdgeX,
  backExtension,
  bubbleCenter,
  BUBBLE_RADIUS,
  gateBody,
  gateBodyPath,
  outputStartX,
  xorBackPath,
  type GateSymbol as GateSymbolSpec,
} from './gateShapes';

interface GateSymbolProps {
  readonly symbol: GateSymbolSpec;
  readonly geometry: Pick<ElementGeometry, 'width' | 'height' | 'pins'>;
  /** Сигнал на выходе: активный выход подсвечивает символ. */
  readonly output: Signal;
  readonly selected?: boolean;
  /** Масштаб отображения (превью в палитре). */
  readonly scale?: number;
  readonly className?: string;
}

const STROKE = '#cbd5e1';

/** ANSI-символ вентиля: входные линии, корпус, кружок инверсии и выходная линия. */
export function GateSymbol({
  symbol,
  geometry,
  output,
  selected = false,
  scale = 1,
  className = 'absolute inset-0 overflow-visible',
}: GateSymbolProps) {
  const { width, height, pins } = geometry;
  const box = gateBody(height);
  const inputs = pins.filter((pin) => pin.direction === 'input');
  const extension = backExtension(box, inputs.map((pin) => pin.y));
  const active = output === 1;
  const outColor = signalColor(output);
  const bodyStroke = output === 0 ? STROKE : outColor;
  const fill = active ? 'rgba(52, 211, 153, 0.14)' : output === 'X' ? 'rgba(251, 191, 36, 0.12)' : '#1e293b';
  const { cx, cy } = bubbleCenter(box);

  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={selected ? { filter: 'drop-shadow(0 0 4px #38bdf8)' } : undefined}
      aria-hidden
    >
      <g stroke={STROKE} strokeWidth={2} strokeLinecap="round" fill="none">
        {inputs.map((pin) => (
          <line key={pin.id} x1={0} y1={pin.y} x2={backEdgeX(symbol, box, pin.y)} y2={pin.y} />
        ))}
        {extension && <line x1={box.x} y1={extension.y1} x2={box.x} y2={extension.y2} />}
        {symbol.shape === 'xor' && <path d={xorBackPath(box)} stroke={bodyStroke} />}
      </g>
      <path d={gateBodyPath(symbol, box)} fill={fill} stroke={bodyStroke} strokeWidth={2} strokeLinejoin="round" />
      {symbol.inverted && (
        <circle cx={cx} cy={cy} r={BUBBLE_RADIUS} fill="#0f172a" stroke={bodyStroke} strokeWidth={2} />
      )}
      <line
        x1={outputStartX(box)}
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke={outColor}
        strokeWidth={active ? 3 : 2}
        strokeLinecap="round"
      />
    </svg>
  );
}
