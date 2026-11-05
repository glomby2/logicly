import { or } from '../../logic/ops';
import { defineGate } from './gate';

export const OR = defineGate({
  type: 'OR',
  description: 'Логическое ИЛИ: 1, если хотя бы на одном входе 1',
  operation: or,
});
