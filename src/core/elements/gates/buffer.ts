import { defineUnaryGate } from './gate';

export const BUFFER = defineUnaryGate({
  type: 'BUFFER',
  description: 'Буфер: повторяет входной сигнал',
  operation: (input) => input,
});
