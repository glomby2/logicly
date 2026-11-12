import type { Signal } from '@/core/logic/signal';

export type SignalTone = 'high' | 'low' | 'unknown';

export function signalTone(signal: Signal): SignalTone {
  if (signal === 'X') return 'unknown';
  return signal === 1 ? 'high' : 'low';
}

/** Единственный источник цветов сигналов: провода, пины, символы, мини-карта. */
export const SIGNAL_COLORS: Readonly<Record<SignalTone, string>> = {
  high: '#34d399',
  low: '#64748b',
  unknown: '#fbbf24',
};

export const signalColor = (signal: Signal) => SIGNAL_COLORS[signalTone(signal)];
