import { describe, expect, it } from 'vitest';
import { channelMatch, DEMUX, MAX_SELECT_BITS, MIN_SELECT_BITS, MUX, readAddress, resolveProps } from '@/core/elements';
import type { KnownSignal, Signal } from '@/core/logic/signal';
import type { ElementDefinition } from '@/core/types/element';
import { combinations, knownCombinations, ternaryCombinations } from '../../helpers/combinations';

/*
 * Комбинационные элементы с входами выбора: MUX (и DEMUX).
 * Порядок входов — как в pins(): данные (или D), затем s0…s(k−1); s0 — младший разряд.
 */

const BITS = [1, 2, 3] as const;

const run = (definition: ElementDefinition, selectBits: number, inputs: readonly Signal[]) =>
  definition.evaluate({ inputs, props: { selectBits }, state: undefined }).outputs;

/** Адрес по битам выбора: s0 — младший разряд. */
const address = (select: readonly KnownSignal[]) => select.reduce<number>((sum, bit, i) => sum + bit * 2 ** i, 0);

/**
 * Точное троичное расширение: каждый выход — общее значение по всем способам заменить X
 * на 0 или 1 (иначе X). Строже этого монотонный элемент быть не может.
 */
function exactExtension(f: (inputs: readonly KnownSignal[]) => readonly Signal[], inputs: readonly Signal[]): Signal[] {
  const unknown = inputs.flatMap((v, i) => (v === 'X' ? [i] : []));
  let result: Signal[] | undefined;
  for (const fill of knownCombinations(unknown.length)) {
    const known = inputs.map((v) => (v === 'X' ? 0 : v)) as KnownSignal[];
    unknown.forEach((index, k) => (known[index] = fill[k]!));
    const outputs = f(known);
    result = result ? result.map((v, i) => (v === outputs[i] ? v : 'X')) : [...outputs];
  }
  return result!;
}

/** Совпадение адреса на входах выбора с каждым каналом. */
const matches = (select: readonly Signal[]) => {
  const address = readAddress(select, 0, select.length);
  return Array.from({ length: 2 ** select.length }, (_, channel) => channelMatch(address, channel));
};

describe('адрес на входах выбора', () => {
  it('readAddress: маска известных разрядов и их значения, s0 — младший', () => {
    expect(readAddress([1, 0, 1], 0, 3)).toEqual({ known: 0b111, value: 0b101, bits: 3 });
    expect(readAddress([1, 'X'], 0, 2)).toEqual({ known: 0b01, value: 0b01, bits: 2 });
    // Смещение: адрес после входов данных; неподключённый вход — 0.
    expect(readAddress([1, 1, 'X'], 2, 2)).toEqual({ known: 0b10, value: 0, bits: 2 });
  });

  it('известный адрес выбирает один канал', () => {
    expect(matches([1, 0])).toEqual([0, 1, 0, 0]);
    expect(matches([0, 1])).toEqual([0, 0, 1, 0]);
    expect(matches([1, 1, 1])).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('X в адресе оставляет возможными каналы с совпадающими известными разрядами', () => {
    expect(matches(['X'])).toEqual(['X', 'X']);
    expect(matches(['X', 1])).toEqual([0, 0, 'X', 'X']);
    expect(matches([0, 'X'])).toEqual(['X', 0, 'X', 0]);
  });

  it('на всех адресах: канал совместим, если совпадает с адресом при какой-нибудь замене X', () => {
    for (const bits of BITS) {
      for (const select of ternaryCombinations(bits)) {
        const result = matches(select);
        expect(result.some((m) => m !== 0), `${select}`).toBe(true);
        result.forEach((match, channel) => {
          const fits = select.every((s, bit) => s === 'X' || s === ((channel >> bit) & 1));
          const exact = select.every((s) => s !== 'X');
          expect(match, `${select} → ${channel}`).toBe(!fits ? 0 : exact ? 1 : 'X');
        });
      }
    }
  });
});

describe('MUX', () => {
  it('по умолчанию 2:1, свойство «Входы выбора» 1–3, категория комбинационных схем', () => {
    expect(MUX.defaultProps).toEqual({ selectBits: 1 });
    expect(MUX.propSchema).toEqual([
      { key: 'selectBits', label: 'Входы выбора', kind: 'integer', min: MIN_SELECT_BITS, max: MAX_SELECT_BITS },
    ]);
    expect([MIN_SELECT_BITS, MAX_SELECT_BITS]).toEqual([1, 3]);
    expect(MUX.category).toBe('combinational');
    expect(MUX.label).toBe('MUX');
  });

  it.each(BITS)('пины при %i входах выбора: данные слева, выбор снизу, выход y', (bits) => {
    const { inputs, outputs } = MUX.pins({ selectBits: bits });
    const data = Array.from({ length: 2 ** bits }, (_, i) => ({ id: `d${i}`, label: `D${i}` }));
    const select = Array.from({ length: bits }, (_, i) => ({ id: `s${i}`, label: `S${i}`, side: 'bottom' }));
    expect(inputs).toEqual([...data, ...select]);
    expect(outputs).toEqual([{ id: 'y', label: 'Y' }]);
  });

  it('id пинов стабильны при смене разрядности: d0, d1, s0 сохраняются', () => {
    const ids = (bits: number) => MUX.pins({ selectBits: bits }).inputs.map((p) => p.id);
    expect(ids(2)).toEqual(expect.arrayContaining(ids(1)));
    expect(ids(3)).toEqual(expect.arrayContaining(ids(2)));
  });

  it('разрядность вне диапазона ограничивается при разборе свойств', () => {
    expect(resolveProps(MUX, { selectBits: 0 })).toEqual({ selectBits: 1 });
    expect(resolveProps(MUX, { selectBits: 7 })).toEqual({ selectBits: 3 });
    expect(resolveProps(MUX, { selectBits: 2.4 })).toEqual({ selectBits: 2 });
  });

  it.each(BITS)('%i входа выбора: все известные комбинации — выход равен выбранному D', (bits) => {
    const count = 2 ** bits;
    for (const inputs of knownCombinations(count + bits)) {
      const select = inputs.slice(count);
      expect(run(MUX, bits, inputs), inputs.join('')).toEqual([inputs[address(select)]]);
    }
  });

  it('X на выбранном входе данных даёт X, на невыбранном — не влияет', () => {
    expect(run(MUX, 1, ['X', 1, 0])).toEqual(['X']);
    expect(run(MUX, 1, ['X', 1, 1])).toEqual([1]);
    expect(run(MUX, 2, [0, 'X', 'X', 1, 1, 1])).toEqual([1]);
    expect(run(MUX, 2, [0, 'X', 'X', 1, 1, 0])).toEqual(['X']);
  });

  it('X на входе выбора: общее значение совместимых каналов', () => {
    expect(run(MUX, 1, [1, 1, 'X'])).toEqual([1]);
    expect(run(MUX, 1, [0, 0, 'X'])).toEqual([0]);
    expect(run(MUX, 1, [0, 1, 'X'])).toEqual(['X']);
    // S1 = 1 известен, S0 = X: кандидаты только D2 и D3.
    expect(run(MUX, 2, [0, 1, 1, 1, 'X', 1])).toEqual([1]);
    expect(run(MUX, 2, [1, 1, 0, 1, 'X', 1])).toEqual(['X']);
    // Все входы выбора X: общее значение всех каналов.
    expect(run(MUX, 3, [1, 1, 1, 1, 1, 1, 1, 1, 'X', 'X', 'X'])).toEqual([1]);
    expect(run(MUX, 3, [1, 1, 1, 1, 1, 1, 1, 0, 'X', 'X', 'X'])).toEqual(['X']);
  });

  it.each([1, 2])('%i входа выбора: на всех троичных наборах — точное троичное расширение', (bits) => {
    const count = 2 ** bits;
    const known = (inputs: readonly KnownSignal[]) => [inputs[address(inputs.slice(count))]!];
    for (const inputs of ternaryCombinations(count + bits)) {
      expect(run(MUX, bits, inputs), inputs.join('')).toEqual(exactExtension(known, inputs));
    }
  });

  it('3 входа выбора: точное расширение для каждого адреса с X и разных данных', () => {
    const count = 8;
    const known = (inputs: readonly KnownSignal[]) => [inputs[address(inputs.slice(count))]!];
    const dataSets: Signal[][] = [Array(8).fill(1), Array(8).fill(0), [0, 1, 0, 1, 0, 1, 0, 1], [1, 1, 0, 0, 1, 1, 'X', 0]];
    for (const select of combinations<Signal>(3, [0, 1, 'X'])) {
      for (const data of dataSets) {
        const inputs = [...data, ...select];
        expect(run(MUX, 3, inputs), inputs.join('')).toEqual(exactExtension(known, inputs));
      }
    }
  });

  it('неподключённые входы читаются как 0: выбран D0', () => {
    expect(run(MUX, 2, [1])).toEqual([1]);
    expect(run(MUX, 2, [])).toEqual([0]);
  });
});

describe('DEMUX', () => {
  it('по умолчанию 1:2, то же свойство «Входы выбора», категория комбинационных схем', () => {
    expect(DEMUX.defaultProps).toEqual({ selectBits: 1 });
    expect(DEMUX.propSchema).toEqual(MUX.propSchema);
    expect(DEMUX.category).toBe('combinational');
    expect(DEMUX.label).toBe('DEMUX');
  });

  it.each(BITS)('пины при %i входах выбора: D слева, выбор снизу, выходы y0… справа', (bits) => {
    const { inputs, outputs } = DEMUX.pins({ selectBits: bits });
    const select = Array.from({ length: bits }, (_, i) => ({ id: `s${i}`, label: `S${i}`, side: 'bottom' }));
    expect(inputs).toEqual([{ id: 'd', label: 'D' }, ...select]);
    expect(outputs).toEqual(Array.from({ length: 2 ** bits }, (_, i) => ({ id: `y${i}`, label: `Y${i}` })));
  });

  it('id выходов стабильны при смене разрядности: y0, y1 сохраняются', () => {
    const ids = (bits: number) => DEMUX.pins({ selectBits: bits }).outputs.map((p) => p.id);
    expect(ids(2)).toEqual(expect.arrayContaining(ids(1)));
    expect(ids(3)).toEqual(expect.arrayContaining(ids(2)));
  });

  it.each(BITS)('%i входа выбора: все известные комбинации — D на выбранном выходе, остальные 0', (bits) => {
    for (const inputs of knownCombinations(1 + bits)) {
      const [data, ...select] = inputs;
      const expected = Array.from({ length: 2 ** bits }, (_, i) => (i === address(select) ? data : 0));
      expect(run(DEMUX, bits, inputs), inputs.join('')).toEqual(expected);
    }
  });

  it('X на входе D: X на выбранном выходе, остальные 0', () => {
    expect(run(DEMUX, 1, ['X', 1])).toEqual([0, 'X']);
    expect(run(DEMUX, 2, ['X', 0, 1])).toEqual([0, 0, 'X', 0]);
  });

  it('X на входе выбора: возможные выходы — X при D = 1 и 0 при D = 0, исключённые — 0', () => {
    expect(run(DEMUX, 1, [1, 'X'])).toEqual(['X', 'X']);
    expect(run(DEMUX, 1, [0, 'X'])).toEqual([0, 0]);
    expect(run(DEMUX, 2, [1, 'X', 1])).toEqual([0, 0, 'X', 'X']);
    expect(run(DEMUX, 2, ['X', 1, 'X'])).toEqual([0, 'X', 0, 'X']);
    expect(run(DEMUX, 3, [1, 'X', 'X', 'X'])).toEqual(Array(8).fill('X'));
  });

  const demuxKnown = (bits: number) => (inputs: readonly KnownSignal[]) =>
    Array.from({ length: 2 ** bits }, (_, i) => (i === address(inputs.slice(1)) ? inputs[0]! : 0));

  it.each(BITS)('%i входа выбора: на всех троичных наборах — точное троичное расширение', (bits) => {
    for (const inputs of ternaryCombinations(1 + bits)) {
      expect(run(DEMUX, bits, inputs), inputs.join('')).toEqual(exactExtension(demuxKnown(bits), inputs));
    }
  });

  it('неподключённые входы читаются как 0: все выходы 0', () => {
    expect(run(DEMUX, 2, [])).toEqual([0, 0, 0, 0]);
    expect(run(DEMUX, 2, [1])).toEqual([1, 0, 0, 0]);
  });
});
