import { UNKNOWN, type Signal } from '../../logic/signal';
import type { ElementDefinition } from '../../types/element';
import {
  channelCount,
  channelMatch,
  channelPins,
  MIN_SELECT_BITS,
  readAddress,
  SELECT_BITS_SPEC,
  selectPins,
  type SelectProps,
} from './select';

const OUTPUTS = [{ id: 'y', label: 'Y' }] as const;

/**
 * Мультиплексор 2ⁿ:1. Входы: данные `d0…d(2ⁿ−1)` слева, выбор `s0…s(n−1)` снизу
 * (`s0` — младший разряд); выход `y`.
 *
 * Если на входах выбора есть X, выход — общее значение всех каналов, которые адрес
 * не исключает (иначе X): при S0 = X и D0 = D1 = 1 выход равен 1, а не X.
 */
export const MUX: ElementDefinition<SelectProps> = {
  type: 'MUX',
  label: 'MUX',
  description: 'Мультиплексор: передаёт на выход Y вход данных D с номером, заданным входами выбора (S0 — младший разряд)',
  category: 'combinational',
  defaultProps: { selectBits: MIN_SELECT_BITS },
  propSchema: [SELECT_BITS_SPEC],
  pins: ({ selectBits }) => ({
    inputs: [...channelPins('d', channelCount(selectBits)), ...selectPins(selectBits)],
    outputs: OUTPUTS,
  }),
  evaluate: ({ inputs, props }) => {
    const count = channelCount(props.selectBits);
    const address = readAddress(inputs, count, props.selectBits);
    // Общее значение каналов-кандидатов; хотя бы один кандидат есть всегда.
    let result: Signal | undefined;
    for (let channel = 0; channel < count; channel++) {
      if (channelMatch(address, channel) === 0) continue;
      const data = inputs[channel] ?? 0;
      if (result === undefined) result = data;
      else if (result !== data) return { outputs: [UNKNOWN] };
    }
    return { outputs: [result ?? UNKNOWN] };
  },
};
