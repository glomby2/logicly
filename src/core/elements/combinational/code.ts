import type { PinSpec, PropSpec } from '../../types/element';

/*
 * Общее для элементов, переводящих двоичный код в позиционный и обратно
 * (DECODER, ENCODER, PRIORITY ENCODER): свойство разрядности и пины кода.
 * Число позиционных линий — `channelCount` из `select.ts` (2^codeBits).
 */

export type CodeProps = { readonly codeBits: number };

export const MIN_CODE_BITS = 2;
export const MAX_CODE_BITS = 3;

export const CODE_BITS_SPEC: PropSpec = {
  key: 'codeBits',
  label: 'Разрядность кода',
  kind: 'integer',
  min: MIN_CODE_BITS,
  max: MAX_CODE_BITS,
};

/** Пины двоичного кода `a0…a(n−1)` с подписями `A0…`; `a0` — младший разряд. */
export function codePins(bits: number): PinSpec[] {
  return Array.from({ length: bits }, (_, i) => ({ id: `a${i}`, label: `A${i}` }));
}
