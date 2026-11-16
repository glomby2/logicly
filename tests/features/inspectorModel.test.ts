import { describe, expect, it } from 'vitest';
import { AND, BUILTIN_ELEMENTS, CODE_BITS_SPEC, CONSTANT, createDefaultRegistry, ElementRegistry } from '@/core/elements';
import { pinRefFromKey } from '@/core/simulation';
import { buildInspectorModel, componentName, type InspectorInput } from '@/features/inspector/inspectorModel';
import { EMPTY_SELECTION } from '@/store';
import { CircuitBuilder } from '../helpers/circuitBuilder';
import { TEST_FLAG } from '../helpers/fixtureElements';

const registry = createDefaultRegistry();

/** A → G1.in0, G1 → L; G2 без проводов. */
const circuit = () => {
  const built = new CircuitBuilder()
    .input('A', true)
    .gate('G1', 'AND', 3)
    .gate('G2', 'AND')
    .output('L')
    .wire('A', 'G1.in0')
    .wire('G1', 'L')
    .build();
  return { ...built, components: built.components.map((c) => (c.id === 'A' ? { ...c, label: 'X1' } : c)) };
};

const input = (overrides: Partial<InspectorInput> = {}): InspectorInput => ({
  circuit: circuit(),
  selection: EMPTY_SELECTION,
  registry,
  floatingInputs: new Set(),
  unknownNets: [],
  ...overrides,
});

describe('componentName', () => {
  it('подпись, иначе тип с номером среди однотипных, а для единственного — просто тип', () => {
    const c = circuit();
    const [a, g1, g2, l] = c.components;
    expect(componentName(c, registry, a!)).toBe('X1');
    expect(componentName(c, registry, g1!)).toBe('AND #1');
    expect(componentName(c, registry, g2!)).toBe('AND #2');
    expect(componentName(c, registry, l!)).toBe('OUTPUT');
  });
});

describe('buildInspectorModel', () => {
  it('один элемент: описание, свойства из propSchema и пины с признаком подключения', () => {
    const model = buildInspectorModel(input({ selection: { components: ['G1'], wires: [] } }));
    expect(model).toMatchObject({
      kind: 'component',
      name: 'AND #1',
      title: 'AND',
      description: AND.description,
      props: AND.propSchema,
      toggle: false,
    });
    if (model.kind !== 'component') throw new Error();
    expect(model.pins).toEqual([
      { id: 'in0', direction: 'input', index: 0, connected: true },
      { id: 'in1', direction: 'input', index: 1, connected: false },
      { id: 'in2', direction: 'input', index: 2, connected: false },
      { id: 'out0', direction: 'output', index: 0, connected: true },
    ]);
  });

  it('INPUT можно переключать; положение переключателя — из value; свойств в инспекторе нет', () => {
    const model = buildInspectorModel(input({ selection: { components: ['A'], wires: [] } }));
    expect(model).toMatchObject({ kind: 'component', toggle: true, toggleOn: true, props: [] });
    const off = { ...circuit(), components: circuit().components.map((c) => (c.id === 'A' ? { ...c, props: { value: false } } : c)) };
    expect(buildInspectorModel(input({ circuit: off, selection: { components: ['A'], wires: [] } }))).toMatchObject({
      toggle: true,
      toggleOn: false,
    });
  });

  it('DECODER и CONSTANT: свойства из propSchema, переключателя нет', () => {
    const built = new CircuitBuilder().add('D', 'DECODER', { codeBits: 3 }).add('K', 'CONSTANT', { level: true }).build();
    const of = (id: string) => buildInspectorModel(input({ circuit: built, selection: { components: [id], wires: [] } }));
    expect(of('D')).toMatchObject({ kind: 'component', title: 'DECODER', props: [CODE_BITS_SPEC], toggle: false, toggleOn: false });
    expect(of('K')).toMatchObject({ kind: 'component', title: 'CONSTANT', props: CONSTANT.propSchema, toggle: false, toggleOn: false });
    const decoder = of('D');
    if (decoder.kind !== 'component') throw new Error();
    expect(decoder.pins.map((p) => p.id)).toEqual(['a0', 'a1', 'a2', 'y0', 'y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7']);
  });

  it('переключатель — только у роли внешнего входа: логическое value без port не переключается', () => {
    const flagCircuit = new CircuitBuilder().add('F', 'TEST_FLAG', { value: true }).build();
    const model = buildInspectorModel(
      input({
        circuit: flagCircuit,
        registry: new ElementRegistry([...BUILTIN_ELEMENTS, TEST_FLAG]),
        selection: { components: ['F'], wires: [] },
      }),
    );
    expect(model).toMatchObject({ kind: 'component', toggle: false, toggleOn: false, props: TEST_FLAG.propSchema });
  });

  it('провод: откуда и куда', () => {
    const model = buildInspectorModel(input({ selection: { components: [], wires: ['w1'] } }));
    expect(model).toMatchObject({
      kind: 'wire',
      from: { componentId: 'A', componentName: 'X1', pinId: 'out0', direction: 'output', index: 0 },
      to: { componentId: 'G1', componentName: 'AND #1', pinId: 'in0', direction: 'input', index: 0 },
    });
  });

  it('несколько объектов: количество и разбивка по типам', () => {
    const model = buildInspectorModel(input({ selection: { components: ['G1', 'G2', 'L'], wires: ['w2'] } }));
    expect(model).toEqual({
      kind: 'multiple',
      components: 3,
      wires: 1,
      byType: [
        { type: 'AND', title: 'AND', count: 2 },
        { type: 'OUTPUT', title: 'OUTPUT', count: 1 },
      ],
    });
  });

  it('ничего не выделено: сводка и проблемы — сначала X, затем неподключённые входы по порядку схемы', () => {
    const model = buildInspectorModel(
      input({
        floatingInputs: new Set(['G2:in1', 'G1:in2', 'G1:in1', 'G2:in0']),
        unknownNets: ['G2:out0'],
      }),
    );
    if (model.kind !== 'circuit') throw new Error(model.kind);
    expect(model.components).toBe(4);
    expect(model.wires).toBe(2);
    expect(model.issues.map((i) => `${i.kind} ${i.endpoint.componentName} ${i.endpoint.pinId}`)).toEqual([
      'unknown AND #2 out0',
      'floating AND #1 in1',
      'floating AND #1 in2',
      'floating AND #2 in0',
      'floating AND #2 in1',
    ]);
  });

  it('выделенные id, которых уже нет в схеме, не учитываются', () => {
    expect(buildInspectorModel(input({ selection: { components: ['gone'], wires: [] } })).kind).toBe('circuit');
    expect(buildInspectorModel(input({ selection: { components: ['G1', 'gone'], wires: [] } })).kind).toBe(
      'component',
    );
  });

  it('проблемы с несуществующими элементами отбрасываются', () => {
    const model = buildInspectorModel(input({ floatingInputs: new Set(['gone:in0', 'bad']) }));
    expect(model).toMatchObject({ kind: 'circuit', issues: [] });
  });
});

describe('pinRefFromKey', () => {
  it('разбирает ключ по последнему двоеточию', () => {
    expect(pinRefFromKey('and-1:in0')).toEqual({ componentId: 'and-1', pinId: 'in0' });
    expect(pinRefFromKey('a:b:out0')).toEqual({ componentId: 'a:b', pinId: 'out0' });
    expect(pinRefFromKey('nokey')).toBeNull();
    expect(pinRefFromKey(':in0')).toBeNull();
    expect(pinRefFromKey('a:')).toBeNull();
  });
});
