import { or } from '../../logic/ops';
import type { Signal } from '../../logic/signal';
import type { ElementDefinition } from '../../types/element';
import { CODE_BITS_SPEC, codePins, MIN_CODE_BITS, type CodeProps } from './code';
import { channelCount, channelPins } from './select';

/**
 * Шифратор 2ⁿ:n. Входы `d0…d(2ⁿ−1)` слева; выходы кода `a0…a(n−1)` (`a0` — младший разряд).
 *
 * Разряд j — OR входов, в номере которых установлен разряд j (как схема на вентилях):
 * при нескольких активных входах — побитовое ИЛИ номеров, D0 на выход не влияет.
 * Каждый вход входит в разряд не больше одного раза, поэтому OR по Клини точен при X.
 */
export const ENCODER: ElementDefinition<CodeProps> = {
  type: 'ENCODER',
  label: 'ENCODER',
  description:
    'Шифратор: выдаёт на A двоичный номер активного входа D (A0 — младший разряд); при нескольких активных входах — побитовое ИЛИ номеров; D0 на выход не влияет',
  category: 'combinational',
  defaultProps: { codeBits: MIN_CODE_BITS },
  propSchema: [CODE_BITS_SPEC],
  pins: ({ codeBits }) => ({ inputs: channelPins('d', channelCount(codeBits)), outputs: codePins(codeBits) }),
  variant: ({ codeBits }) => `${channelCount(codeBits)}:${codeBits}`,
  evaluate: ({ inputs, props }) => {
    const count = channelCount(props.codeBits);
    return {
      outputs: Array.from({ length: props.codeBits }, (_, bit) => {
        const lines: Signal[] = [];
        for (let line = 0; line < count; line++) if (line & (1 << bit)) lines.push(inputs[line] ?? 0);
        return or(lines);
      }),
    };
  },
};
