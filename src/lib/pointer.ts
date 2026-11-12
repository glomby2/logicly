/** Основной указатель — палец (сенсорный экран), а не мышь. */
export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}
