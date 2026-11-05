import { xor } from '../../logic/ops';
import { defineGate } from './gate';

export const XOR = defineGate({
  type: 'XOR',
  description: 'Исключающее ИЛИ: 1, если число единиц на входах нечётное',
  operation: xor,
});
