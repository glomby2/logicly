import { PIN_PITCH } from '../layout/geometry';

/*
 * Символы MUX и DEMUX — трапеция: широкая сторона у каналов, узкая — у одиночного пина.
 * Реестр по типу элемента, как у вентилей (`GATE_SYMBOLS`).
 */

/** `narrow-right` — MUX (сужается к выходу Y), `narrow-left` — DEMUX (сужается к входу D). */
export type MuxOrientation = 'narrow-right' | 'narrow-left';

export const MUX_SYMBOLS: ReadonlyMap<string, MuxOrientation> = new Map([
  ['MUX', 'narrow-right'],
  ['DEMUX', 'narrow-left'],
]);

const n = (value: number) => Number(value.toFixed(2));

/** На сколько узкая сторона короче широкой с каждого края. */
export function muxInset(height: number): number {
  return Math.min(PIN_PITCH, height / 4);
}

/** Замкнутый контур трапеции по границам узла. */
export function muxBodyPath(orientation: MuxOrientation, width: number, height: number): string {
  const d = muxInset(height);
  return orientation === 'narrow-right'
    ? `M 0 0 L ${n(width)} ${n(d)} L ${n(width)} ${n(height - d)} L 0 ${n(height)} Z`
    : `M 0 ${n(d)} L ${n(width)} 0 L ${n(width)} ${n(height)} L 0 ${n(height - d)} Z`;
}

/** Y нижней (наклонной) стороны на расстоянии `x` от левого края — до неё идут линии входов выбора. */
export function muxBottomEdgeY(orientation: MuxOrientation, width: number, height: number, x: number): number {
  const t = Math.min(1, Math.max(0, x / width));
  return n(height - muxInset(height) * (orientation === 'narrow-right' ? t : 1 - t));
}
