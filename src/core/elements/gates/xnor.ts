import { not, xor } from '../../logic/ops';
import { defineGate } from './gate';

export const XNOR = defineGate({
  type: 'XNOR',
  description: 'Исключающее ИЛИ-НЕ: 1, если число единиц на входах чётное',
  operation: (inputs) => not(xor(inputs)),
});
