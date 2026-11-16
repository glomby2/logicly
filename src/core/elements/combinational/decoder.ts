import type { ElementDefinition } from '../../types/element';
import { CODE_BITS_SPEC, codePins, MIN_CODE_BITS, type CodeProps } from './code';
import { channelCount, channelMatch, channelPins, readAddress } from './select';

/**
 * Дешифратор n:2ⁿ. Входы: код `a0…a(n−1)` слева (`a0` — младший разряд); выходы `y0…y(2ⁿ−1)`.
 *
 * Выход — совпадение кода с номером: выбранный 1, исключённый известным разрядом 0,
 * возможный при X в коде — X. Каждый выход — минтерм, поэтому это точное троичное расширение.
 * Неподключённые входы равны 0: Y0 = 1.
 */
export const DECODER: ElementDefinition<CodeProps> = {
  type: 'DECODER',
  label: 'DECODER',
  description:
    'Дешифратор: выход Y с номером, заданным двоичным кодом на входах A (A0 — младший разряд), равен 1, остальные — 0',
  category: 'combinational',
  defaultProps: { codeBits: MIN_CODE_BITS },
  propSchema: [CODE_BITS_SPEC],
  pins: ({ codeBits }) => ({ inputs: codePins(codeBits), outputs: channelPins('y', channelCount(codeBits)) }),
  variant: ({ codeBits }) => `${codeBits}:${channelCount(codeBits)}`,
  evaluate: ({ inputs, props }) => {
    const address = readAddress(inputs, 0, props.codeBits);
    return {
      outputs: Array.from({ length: channelCount(props.codeBits) }, (_, line) => channelMatch(address, line)),
    };
  },
};
