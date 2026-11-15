import { and } from '../../logic/ops';
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

const DATA = { id: 'd', label: 'D' } as const;

/**
 * Демультиплексор 1:2ⁿ. Входы: данные `d` слева, выбор `s0…s(n−1)` снизу
 * (`s0` — младший разряд); выходы `y0…y(2ⁿ−1)` справа.
 *
 * Выход канала — AND(D, совпадение адреса с каналом): выбранный канал получает D,
 * исключённый известным разрядом — 0 (даже при D = X), возможный при X в адресе —
 * 0 при D = 0, иначе X.
 */
export const DEMUX: ElementDefinition<SelectProps> = {
  type: 'DEMUX',
  label: 'DEMUX',
  description:
    'Демультиплексор: передаёт вход D на выход Y с номером, заданным входами выбора (S0 — младший разряд); остальные выходы равны 0',
  category: 'combinational',
  defaultProps: { selectBits: MIN_SELECT_BITS },
  propSchema: [SELECT_BITS_SPEC],
  pins: ({ selectBits }) => ({
    inputs: [DATA, ...selectPins(selectBits)],
    outputs: channelPins('y', channelCount(selectBits)),
  }),
  evaluate: ({ inputs, props }) => {
    const data = inputs[0] ?? 0;
    const address = readAddress(inputs, 1, props.selectBits);
    return {
      outputs: Array.from({ length: channelCount(props.selectBits) }, (_, channel) =>
        and([data, channelMatch(address, channel)]),
      ),
    };
  },
};
