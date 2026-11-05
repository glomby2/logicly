import { not } from '../../logic/ops';
import { defineUnaryGate } from './gate';

export const NOT = defineUnaryGate({
  type: 'NOT',
  description: 'Инвертор: меняет 0 на 1 и 1 на 0',
  operation: not,
});
