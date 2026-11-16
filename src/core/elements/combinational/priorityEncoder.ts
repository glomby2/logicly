import { join, or } from '../../logic/ops';
import { UNKNOWN, type Signal } from '../../logic/signal';
import type { ElementDefinition } from '../../types/element';
import { CODE_BITS_SPEC, codePins, MIN_CODE_BITS, type CodeProps } from './code';
import { channelCount, channelPins } from './select';

const VALID = { id: 'v', label: 'V' } as const;

/**
 * Возможные победители: старший вход с известной 1 и все входы с X выше него.
 * Если известной 1 нет — все входы с X и `null` («нет победителя»).
 * Каждый вариант достижим некоторой заменой X на 0 или 1.
 */
function possibleWinners(inputs: readonly Signal[], count: number): (number | null)[] {
  const winners: (number | null)[] = [];
  for (let line = count - 1; line >= 0; line--) {
    const signal = inputs[line] ?? 0;
    if (signal === 1) {
      winners.push(line);
      return winners;
    }
    if (signal === UNKNOWN) winners.push(line);
  }
  winners.push(null);
  return winners;
}

/**
 * Приоритетный шифратор 2ⁿ:n. Входы `d0…d(2ⁿ−1)`; выходы кода `a0…a(n−1)` (`a0` — младший разряд)
 * и `v` — есть активный вход. Побеждает старший номер; без активных входов A = 0, V = 0.
 *
 * Точная троичная семантика: разряд кода — общее значение по всем возможным победителям
 * (иначе X); V — OR входов по Клини (совпадает с тем же объединением).
 */
export const PRIORITY_ENCODER: ElementDefinition<CodeProps> = {
  type: 'PRIORITY_ENCODER',
  label: 'PRIORITY ENCODER',
  description:
    'Приоритетный шифратор: выдаёт на A номер старшего активного входа D (A0 — младший разряд); V = 1, если активен хотя бы один вход',
  category: 'combinational',
  defaultProps: { codeBits: MIN_CODE_BITS },
  propSchema: [CODE_BITS_SPEC],
  pins: ({ codeBits }) => ({
    inputs: channelPins('d', channelCount(codeBits)),
    outputs: [...codePins(codeBits), VALID],
  }),
  variant: ({ codeBits }) => `${channelCount(codeBits)}:${codeBits}`,
  evaluate: ({ inputs, props }) => {
    const count = channelCount(props.codeBits);
    const winners = possibleWinners(inputs, count);
    const code = Array.from({ length: props.codeBits }, (_, bit) =>
      winners.map((w): Signal => (w === null ? 0 : ((w >> bit) & 1) as 0 | 1)).reduce(join),
    );
    return { outputs: [...code, or(inputs.slice(0, count))] };
  },
};
