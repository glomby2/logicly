import { UNKNOWN, type Signal } from '../../logic/signal';
import type { PinSpec, PropSpec } from '../../types/element';

/*
 * Общее для элементов с адресом на входах выбора (MUX, DEMUX): свойство разрядности,
 * пины выбора и сопоставление адреса с каналами.
 */

export type SelectProps = { readonly selectBits: number };

export const MIN_SELECT_BITS = 1;
export const MAX_SELECT_BITS = 3;

export const SELECT_BITS_SPEC: PropSpec = {
  key: 'selectBits',
  label: 'Входы выбора',
  kind: 'integer',
  min: MIN_SELECT_BITS,
  max: MAX_SELECT_BITS,
};

/** Число каналов: 2^selectBits (2, 4, 8). */
export function channelCount(selectBits: number): number {
  return 2 ** selectBits;
}

/** Входы выбора `s0…s(k−1)` на нижней стороне; `s0` — младший разряд адреса. */
export function selectPins(selectBits: number): PinSpec[] {
  return Array.from({ length: selectBits }, (_, i) => ({ id: `s${i}`, label: `S${i}`, side: 'bottom' }));
}

/** Пины каналов: `d0…` / `y0…` с подписями `D0…` / `Y0…`. */
export function channelPins(prefix: 'd' | 'y', count: number): PinSpec[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, label: `${prefix.toUpperCase()}${i}` }));
}

/**
 * Адрес на входах выбора: `known` — маска известных разрядов, `value` — их значения.
 * Разряд X в `known` не входит.
 */
export interface SelectAddress {
  readonly known: number;
  readonly value: number;
  readonly bits: number;
}

/** Читает адрес из входов `inputs[offset…offset+bits−1]`; неподключённый вход — 0. */
export function readAddress(inputs: readonly Signal[], offset: number, bits: number): SelectAddress {
  let known = 0;
  let value = 0;
  for (let bit = 0; bit < bits; bit++) {
    const signal = inputs[offset + bit] ?? 0;
    if (signal === UNKNOWN) continue;
    known |= 1 << bit;
    if (signal === 1) value |= 1 << bit;
  }
  return { known, value, bits };
}

/**
 * Совпадение адреса с каналом:
 * - `1` — канал выбран (все разряды известны и совпадают);
 * - `0` — канал исключён: хотя бы один известный разряд не совпадает;
 * - `X` — канал возможен: известные разряды совпадают, но есть X.
 *
 * Хотя бы один канал всегда не исключён. Замена разряда на X превращает 0 или 1 только в X.
 */
export function channelMatch(address: SelectAddress, channel: number): Signal {
  if ((channel & address.known) !== address.value) return 0;
  return address.known === (1 << address.bits) - 1 ? 1 : UNKNOWN;
}
