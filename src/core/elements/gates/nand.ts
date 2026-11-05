import { and, not } from '../../logic/ops';
import { defineGate } from './gate';

export const NAND = defineGate({
  type: 'NAND',
  description: 'И-НЕ: 0, только если на всех входах 1',
  operation: (inputs) => not(and(inputs)),
});
