import { and } from '../../logic/ops';
import { defineGate } from './gate';

export const AND = defineGate({
  type: 'AND',
  description: 'Логическое И: 1, только если на всех входах 1',
  operation: and,
});
