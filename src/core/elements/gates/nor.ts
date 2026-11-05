import { not, or } from '../../logic/ops';
import { defineGate } from './gate';

export const NOR = defineGate({
  type: 'NOR',
  description: 'ИЛИ-НЕ: 1, только если на всех входах 0',
  operation: (inputs) => not(or(inputs)),
});
