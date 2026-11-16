import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { MAX_DOCUMENT_NAME_LENGTH, MAX_FILE_SIZE, parseCircuitFile, type FileError } from '@/core/serialization';
import { toText, validDocument } from '../../helpers/files';

const registry = createDefaultRegistry();

type Doc = Record<string, unknown>;
type Item = Record<string, unknown>;

const parse = (document: unknown) => parseCircuitFile(toText(document), registry);

/** Копия корректного документа с изменением. */
function variant(change: (doc: Doc & { components: Item[]; wires: Item[] }) => void): Doc {
  const doc = structuredClone(validDocument()) as Doc & { components: Item[]; wires: Item[] };
  change(doc);
  return doc;
}

function errorsOf(input: unknown): readonly FileError[] {
  const result = typeof input === 'string' ? parseCircuitFile(input, registry) : parse(input);
  if (result.ok) throw new Error('Файл должен быть отклонён');
  return result.errors;
}

describe('parseCircuitFile: корректный файл', () => {
  it('загружается без предупреждений', () => {
    const result = parse(validDocument());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.name).toBe('Тест');
    expect(result.circuit.components.map((c) => c.id)).toEqual(['a', 'g', 'y']);
    expect(result.circuit.components[0]).toEqual({
      id: 'a',
      type: 'INPUT',
      position: { x: 0, y: 0 },
      label: 'X1',
      props: { value: true },
    });
    expect(result.circuit.wires).toHaveLength(2);
  });

  it('лишние поля верхнего уровня, элементов и позиций игнорируются', () => {
    const result = parse(
      variant((d) => {
        d.extra = 1;
        d.components[0]!.selected = true;
        d.components[0]!.position = { x: 5, y: 6, z: 7 };
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.circuit.components[0]).toEqual(expect.objectContaining({ position: { x: 5, y: 6 } }));
  });

  it('название обрезается по краям и по длине', () => {
    const result = parse(variant((d) => (d.name = `  ${'я'.repeat(MAX_DOCUMENT_NAME_LENGTH + 20)}  `)));
    expect(result.ok && result.name).toBe('я'.repeat(MAX_DOCUMENT_NAME_LENGTH));
  });

  it('не изменяет переданные данные и при повторном разборе даёт тот же результат', () => {
    const text = toText(validDocument());
    expect(parseCircuitFile(text, registry)).toEqual(parseCircuitFile(text, registry));
  });
});

describe('parseCircuitFile: критические ошибки — файл отклоняется целиком', () => {
  const cases: [string, unknown, Partial<FileError>][] = [
    ['неверный JSON', '{ "format": ', { code: 'invalid-json' }],
    ['пустой файл', '', { code: 'invalid-json' }],
    ['не объект', [1, 2], { code: 'not-object' }],
    ['null', null, { code: 'not-object' }],
    ['нет format', variant((d) => delete d.format), { code: 'missing-field', path: 'format' }],
    ['чужой format', variant((d) => (d.format = 'other')), { code: 'wrong-format', detail: 'other' }],
    ['нет version', variant((d) => delete d.version), { code: 'missing-field', path: 'version' }],
    ['version — строка', variant((d) => (d.version = '1')), { code: 'invalid-version' }],
    ['version — дробная', variant((d) => (d.version = 1.5)), { code: 'invalid-version' }],
    ['version = 0', variant((d) => (d.version = 0)), { code: 'invalid-version' }],
    ['версия новее поддерживаемой', variant((d) => (d.version = 2)), { code: 'unsupported-version', detail: '2' }],
    ['нет name', variant((d) => delete d.name), { code: 'missing-field', path: 'name' }],
    ['name — не строка', variant((d) => (d.name = 5)), { code: 'invalid-field', path: 'name' }],
    ['нет components', variant((d) => delete (d as Doc).components), { code: 'missing-field', path: 'components' }],
    ['components — не массив', variant((d) => ((d as Doc).components = {})), { code: 'invalid-field', path: 'components' }],
    ['нет wires', variant((d) => delete (d as Doc).wires), { code: 'missing-field', path: 'wires' }],
    ['элемент — не объект', variant((d) => ((d.components as unknown[])[1] = 'AND')), { code: 'invalid-field', path: 'components[1]' }],
    ['нет id элемента', variant((d) => delete d.components[1]!.id), { code: 'missing-field', path: 'components[1].id' }],
    ['пустой id элемента', variant((d) => (d.components[1]!.id = '')), { code: 'invalid-field', path: 'components[1].id' }],
    ['нет type', variant((d) => delete d.components[1]!.type), { code: 'missing-field', path: 'components[1].type' }],
    ['нет position', variant((d) => delete d.components[1]!.position), { code: 'missing-field', path: 'components[1].position' }],
    [
      'координата — строка',
      variant((d) => (d.components[1]!.position = { x: '1', y: 0 })),
      { code: 'invalid-field', path: 'components[1].position' },
    ],
    ['нет props', variant((d) => delete d.components[1]!.props), { code: 'missing-field', path: 'components[1].props' }],
    ['props — массив', variant((d) => (d.components[1]!.props = [])), { code: 'invalid-field', path: 'components[1].props' }],
    ['провод — не объект', variant((d) => ((d.wires as unknown[])[0] = null)), { code: 'invalid-field', path: 'wires[0]' }],
    ['нет id провода', variant((d) => delete d.wires[0]!.id), { code: 'missing-field', path: 'wires[0].id' }],
    ['нет from', variant((d) => delete d.wires[0]!.from), { code: 'missing-field', path: 'wires[0].from' }],
    [
      'pinId — не строка',
      variant((d) => (d.wires[0]!.to = { componentId: 'g', pinId: 0 })),
      { code: 'invalid-field', path: 'wires[0].to.pinId' },
    ],
    ['повтор id элемента', variant((d) => (d.components[2]!.id = 'g')), { code: 'duplicate-component-id', detail: 'g' }],
    ['повтор id провода', variant((d) => (d.wires[1]!.id = 'w1')), { code: 'duplicate-wire-id', detail: 'w1' }],
    ['неизвестный тип элемента', variant((d) => (d.components[1]!.type = 'UNKNOWN_ELEMENT')), { code: 'unknown-type', detail: 'UNKNOWN_ELEMENT' }],
  ];

  it.each(cases)('%s', (_, input, expected) => {
    expect(errorsOf(input)).toContainEqual(expect.objectContaining(expected));
  });

  it('файл больше допустимого размера', () => {
    expect(errorsOf(' '.repeat(MAX_FILE_SIZE + 1))).toEqual([{ code: 'too-large' }]);
  });

  it('собирает все структурные ошибки сразу', () => {
    const errors = errorsOf(
      variant((d) => {
        delete d.components[0]!.id;
        d.components[1]!.position = null;
        delete d.wires[1]!.to;
      }),
    );
    expect(errors.map((e) => e.path)).toEqual(['components[0].id', 'components[1].position', 'wires[1].to']);
  });

  it('все неизвестные типы перечисляются по одному разу', () => {
    const errors = errorsOf(
      variant((d) => {
        d.components[0]!.type = 'UNKNOWN_ELEMENT';
        d.components[1]!.type = 'UNKNOWN_DEVICE';
        d.components[2]!.type = 'UNKNOWN_ELEMENT';
      }),
    );
    expect(errors).toEqual([
      { code: 'unknown-type', detail: 'UNKNOWN_ELEMENT' },
      { code: 'unknown-type', detail: 'UNKNOWN_DEVICE' },
    ]);
  });
});

describe('parseCircuitFile: исправимые ошибки — схема нормализуется с предупреждением', () => {
  const ok = (document: Doc) => {
    const result = parse(document);
    if (!result.ok) throw new Error(`Файл отклонён: ${JSON.stringify(result.errors)}`);
    return result;
  };

  it('свойства: значения по умолчанию, неверные типы, диапазон, лишние ключи', () => {
    const result = ok(
      variant((d) => {
        d.components[0]!.props = { value: 'да', extra: 1 };
        d.components[1]!.props = { inputCount: 99 };
        d.components[2]!.props = { junk: { nested: true }, list: [1], nothing: null };
      }),
    );
    expect(result.circuit.components.map((c) => c.props)).toEqual([{ value: false }, { inputCount: 8 }, {}]);
    expect(result.warnings).toEqual([{ code: 'props-normalized', count: 3 }]);
  });

  it('недостающее свойство дополняется значением по умолчанию', () => {
    const result = ok(variant((d) => (d.components[1]!.props = {})));
    expect(result.circuit.components[1]!.props).toEqual({ inputCount: 2 });
    expect(result.warnings).toEqual([{ code: 'props-normalized', count: 1 }]);
  });

  it('подпись неверного типа удаляется, пустая подпись — не ошибка', () => {
    const result = ok(
      variant((d) => {
        d.components[0]!.label = 42;
        d.components[1]!.label = '';
      }),
    );
    expect(result.circuit.components[0]!.label).toBeUndefined();
    expect(result.circuit.components[1]).not.toHaveProperty('label');
    expect(result.warnings).toEqual([{ code: 'invalid-label', count: 1 }]);
  });

  it('недопустимые провода удаляются: нет элемента, нет пина, вход→вход, второй источник', () => {
    const wire = (id: string, from: [string, string], to: [string, string]) => ({
      id,
      from: { componentId: from[0], pinId: from[1] },
      to: { componentId: to[0], pinId: to[1] },
    });
    const result = ok(
      variant((d) => {
        d.wires.push(
          wire('w3', ['ghost', 'out0'], ['g', 'in1']),
          wire('w4', ['a', 'out0'], ['g', 'in7']),
          wire('w5', ['g', 'in0'], ['g', 'in1']),
          wire('w6', ['a', 'out0'], ['y', 'in0']),
          wire('w7', ['a', 'out0'], ['g', 'in1']),
        );
      }),
    );
    expect(result.circuit.wires.map((w) => w.id)).toEqual(['w1', 'w2', 'w7']);
    expect(result.warnings).toEqual([{ code: 'wires-removed', count: 4 }]);
  });

  it('провода на пины, исчезнувшие после нормализации свойств, тоже удаляются', () => {
    const result = ok(
      variant((d) => {
        d.components[1]!.props = { inputCount: 1 };
        d.wires.push({ id: 'w3', from: { componentId: 'a', pinId: 'out0' }, to: { componentId: 'g', pinId: 'in1' } });
        d.wires.push({ id: 'w4', from: { componentId: 'a', pinId: 'out0' }, to: { componentId: 'g', pinId: 'in2' } });
      }),
    );
    expect(result.circuit.components[1]!.props).toEqual({ inputCount: 2 });
    expect(result.circuit.wires.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
    expect(result.warnings).toEqual([
      { code: 'props-normalized', count: 1 },
      { code: 'wires-removed', count: 1 },
    ]);
  });

  describe('MUX и DEMUX', () => {
    const wire = (id: string, from: string, to: string) => {
      const [fc = '', fp = ''] = from.split('.');
      const [tc = '', tp = ''] = to.split('.');
      return { id, from: { componentId: fc, pinId: fp }, to: { componentId: tc, pinId: tp } };
    };
    const document = (selectBits: unknown, wires: ReturnType<typeof wire>[]) => ({
      ...validDocument(),
      components: [
        { id: 'a', type: 'INPUT', position: { x: 0, y: 0 }, props: { value: true } },
        { id: 'm', type: 'MUX', position: { x: 100, y: 0 }, props: { selectBits } },
        { id: 'x', type: 'DEMUX', position: { x: 200, y: 0 }, props: { selectBits } },
      ],
      wires,
    });

    it('корректная разрядность загружается без предупреждений', () => {
      const result = ok(document(2, [wire('w1', 'a.out0', 'm.d3'), wire('w2', 'm.y', 'x.d'), wire('w3', 'a.out0', 'x.s1')]));
      expect(result.warnings).toEqual([]);
      expect(result.circuit.wires).toHaveLength(3);
    });

    it('разрядность вне диапазона ограничивается, провода к исчезнувшим пинам удаляются', () => {
      const result = ok(
        document(7, [
          wire('w1', 'a.out0', 'm.d7'),
          wire('w2', 'a.out0', 'm.d8'),
          wire('w3', 'm.y', 'x.d'),
          wire('w4', 'a.out0', 'x.s3'),
        ]),
      );
      expect(result.circuit.components.slice(1).map((c) => c.props)).toEqual([{ selectBits: 3 }, { selectBits: 3 }]);
      expect(result.circuit.wires.map((w) => w.id)).toEqual(['w1', 'w3']);
      expect(result.warnings).toEqual([
        { code: 'props-normalized', count: 2 },
        { code: 'wires-removed', count: 2 },
      ]);
    });

    it('провод на несуществующий вход D3 у MUX 2:1 и выход Y3 у DEMUX 1:2 удаляется', () => {
      const result = ok(
        document(1, [wire('w1', 'a.out0', 'm.d3'), wire('w2', 'x.y3', 'm.d0'), wire('w3', 'x.y1', 'm.d1'), wire('w4', 'a.out0', 'm.y')]),
      );
      expect(result.circuit.wires.map((w) => w.id)).toEqual(['w3']);
      expect(result.warnings).toEqual([{ code: 'wires-removed', count: 3 }]);
    });

    it('selectBits неверного типа заменяется значением по умолчанию', () => {
      const result = ok(document('4:1', []));
      expect(result.circuit.components.slice(1).map((c) => c.props)).toEqual([{ selectBits: 1 }, { selectBits: 1 }]);
      expect(result.warnings).toEqual([{ code: 'props-normalized', count: 2 }]);
    });
  });

  describe('DECODER, ENCODER, PRIORITY ENCODER и CONSTANT', () => {
    const wire = (id: string, from: string, to: string) => {
      const [fc = '', fp = ''] = from.split('.');
      const [tc = '', tp = ''] = to.split('.');
      return { id, from: { componentId: fc, pinId: fp }, to: { componentId: tc, pinId: tp } };
    };
    const document = (codeBits: unknown, level: unknown, wires: ReturnType<typeof wire>[] = []) => ({
      ...validDocument(),
      components: [
        { id: 'k', type: 'CONSTANT', position: { x: 0, y: 0 }, props: { level } },
        { id: 'd', type: 'DECODER', position: { x: 100, y: 0 }, props: { codeBits } },
        { id: 'e', type: 'ENCODER', position: { x: 200, y: 0 }, props: { codeBits } },
        { id: 'p', type: 'PRIORITY_ENCODER', position: { x: 300, y: 0 }, props: { codeBits } },
      ],
      wires,
    });
    const codeBitsOf = (result: ReturnType<typeof ok>) => result.circuit.components.slice(1).map((c) => c.props);

    it('корректные свойства загружаются без предупреждений', () => {
      const result = ok(document(3, false, [wire('w1', 'k.out0', 'd.a2'), wire('w2', 'd.y7', 'e.d7'), wire('w3', 'd.y7', 'p.d7')]));
      expect(result.warnings).toEqual([]);
      expect(result.circuit.wires).toHaveLength(3);
      expect(result.circuit.components[0]!.props).toEqual({ level: false });
    });

    it.each([
      [5, 3],
      [1, 2],
      [2.6, 3],
      ['2', 2],
    ])('codeBits = %j нормализуется в %i с предупреждением', (raw, expected) => {
      const result = ok(document(raw, true));
      expect(codeBitsOf(result)).toEqual([{ codeBits: expected }, { codeBits: expected }, { codeBits: expected }]);
      expect(result.warnings).toEqual([{ code: 'props-normalized', count: 3 }]);
    });

    it('level неверного типа заменяется значением по умолчанию (1)', () => {
      const result = ok(document(2, 'yes'));
      expect(result.circuit.components[0]!.props).toEqual({ level: true });
      expect(result.warnings).toEqual([{ code: 'props-normalized', count: 1 }]);
    });

    it('провода на несуществующие пины (Y7 у DECODER 2:4, D7 у ENCODER 4:2, A2 у PRIORITY 4:2) удаляются', () => {
      const result = ok(
        document(2, true, [
          wire('w1', 'd.y7', 'e.d0'),
          wire('w2', 'd.y3', 'e.d7'),
          wire('w3', 'p.a2', 'e.d1'),
          wire('w4', 'd.y3', 'e.d3'),
          wire('w5', 'p.v', 'e.d2'),
        ]),
      );
      expect(result.circuit.wires.map((w) => w.id)).toEqual(['w4', 'w5']);
      expect(result.warnings).toEqual([{ code: 'wires-removed', count: 3 }]);
    });
  });
});
