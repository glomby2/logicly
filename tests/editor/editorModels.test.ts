import { describe, expect, it } from 'vitest';
import { AND, createDefaultRegistry, INPUT } from '@/core/elements';
import { canConnect } from '@/editor/connectionRules';
import { buildContextMenu, type MenuEntry } from '@/editor/contextMenuModel';
import { SELF_LOOP_MARGIN, selfLoopPath } from '@/editor/edges/wirePath';
import { placementPosition, snapPoint } from '@/editor/placement';
import {
  isEditableTarget,
  NUDGE_LARGE_STEP,
  NUDGE_STEP,
  resolveNudge,
  resolveShortcut,
  type KeyInput,
} from '@/editor/shortcuts';
import { SIGNAL_COLORS, signalColor, signalTone } from '@/editor/signalStyle';
import { groupElements } from '@/features/palette/paletteModel';
import { CircuitBuilder } from '../helpers/circuitBuilder';

const key = (code: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: '',
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...extra,
});

describe('горячие клавиши', () => {
  it.each<[KeyInput, string | null]>([
    [key('KeyZ', { ctrlKey: true }), 'undo'],
    [key('KeyZ', { metaKey: true }), 'undo'],
    [key('KeyZ', { ctrlKey: true, shiftKey: true }), 'redo'],
    [key('KeyY', { ctrlKey: true }), 'redo'],
    [key('KeyC', { ctrlKey: true }), 'copy'],
    [key('KeyX', { ctrlKey: true }), 'cut'],
    [key('KeyV', { ctrlKey: true }), 'paste'],
    [key('KeyD', { ctrlKey: true }), 'duplicate'],
    [key('KeyA', { ctrlKey: true }), 'selectAll'],
    [key('Delete', { key: 'Delete' }), 'delete'],
    [key('Backspace', { key: 'Backspace' }), 'delete'],
    [key('Escape', { key: 'Escape' }), 'escape'],
    [key('KeyZ'), null],
    [key('KeyC', { ctrlKey: true, altKey: true }), null],
  ])('%o → %s', (input, expected) => {
    expect(resolveShortcut(input)).toBe(expected);
  });

  it('работают в русской раскладке: важна физическая клавиша, а не символ', () => {
    expect(resolveShortcut(key('KeyZ', { key: 'я', ctrlKey: true }))).toBe('undo');
    expect(resolveShortcut(key('KeyC', { key: 'с', ctrlKey: true }))).toBe('copy');
  });

  it('справка: F1 и «?» в любой раскладке', () => {
    expect(resolveShortcut(key('F1', { key: 'F1' }))).toBe('help');
    expect(resolveShortcut(key('Slash', { key: '?', shiftKey: true }))).toBe('help');
    expect(resolveShortcut(key('Digit7', { key: '?', shiftKey: true }))).toBe('help');
  });

  it('стрелки: шаг сетки, с Shift — крупный; с Ctrl/Alt — не перемещение', () => {
    expect(resolveNudge(key('ArrowLeft', { key: 'ArrowLeft' }))).toEqual({ dx: -NUDGE_STEP, dy: 0 });
    expect(resolveNudge(key('ArrowDown', { key: 'ArrowDown', shiftKey: true }))).toEqual({ dx: 0, dy: NUDGE_LARGE_STEP });
    expect(resolveNudge(key('ArrowUp', { key: 'ArrowUp' }))).toEqual({ dx: 0, dy: -NUDGE_STEP });
    expect(resolveNudge(key('ArrowRight', { key: 'ArrowRight', ctrlKey: true }))).toBeNull();
    expect(resolveNudge(key('KeyA', { key: 'a' }))).toBeNull();
    expect(resolveShortcut(key('ArrowLeft', { key: 'ArrowLeft' }))).toBeNull();
  });

  it('isEditableTarget без DOM возвращает false', () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('контекстное меню', () => {
  const commands = (entries: MenuEntry[]) =>
    entries.flatMap((e) => (e.kind === 'command' ? [`${e.command}${e.disabled ? ':off' : ''}`] : []));

  it('поле: вставка доступна только при непустом буфере', () => {
    expect(commands(buildContextMenu({ kind: 'pane', flowPosition: { x: 0, y: 0 } }, { canPaste: false }))).toEqual([
      'paste:off',
      'selectAll',
      'fitView',
    ]);
    expect(commands(buildContextMenu({ kind: 'pane', flowPosition: { x: 0, y: 0 } }, { canPaste: true }))[0]).toBe('paste');
  });

  it('провод: только удаление', () => {
    expect(commands(buildContextMenu({ kind: 'edge', id: 'w1' }, { canPaste: false }))).toEqual(['delete']);
  });

  it('INPUT: переключение и переименование; свойств нет', () => {
    const component = { id: 'a', type: 'INPUT', position: { x: 0, y: 0 }, props: { value: false } };
    const entries = buildContextMenu({ kind: 'node', id: 'a' }, { canPaste: false, component, definition: INPUT });
    expect(commands(entries)).toEqual(['toggle', 'rename', 'copy', 'cut', 'duplicate', 'delete']);
    expect(entries.some((e) => e.kind === 'prop')).toBe(false);
  });

  it('вентиль: редактируемое число входов из propSchema', () => {
    const component = { id: 'g', type: 'AND', position: { x: 0, y: 0 }, props: { inputCount: 2 } };
    const entries = buildContextMenu({ kind: 'node', id: 'g' }, { canPaste: false, component, definition: AND });
    expect(commands(entries)[0]).toBe('rename');
    expect(entries.filter((e) => e.kind === 'prop')).toEqual([{ kind: 'prop', spec: AND.propSchema![0] }]);
  });
});

describe('проверка соединений', () => {
  const registry = createDefaultRegistry();
  const c = new CircuitBuilder().input('A').input('B').gate('G', 'AND').wire('A', 'G.in0').build();
  const pin = (componentId: string, pinId: string) => ({ componentId, pinId });

  it('то же правило, что у хранилища: направление, дубликаты, занятые входы', () => {
    expect(canConnect(c, registry, pin('B', 'out0'), pin('G', 'in1'))).toBe(true);
    expect(canConnect(c, registry, pin('G', 'in1'), pin('B', 'out0'))).toBe(true);
    expect(canConnect(c, registry, pin('A', 'out0'), pin('B', 'out0'))).toBe(false);
    expect(canConnect(c, registry, pin('A', 'out0'), pin('G', 'in0'))).toBe(false);
    // Занятый вход разрешён — старый провод будет заменён.
    expect(canConnect(c, registry, pin('B', 'out0'), pin('G', 'in0'))).toBe(true);
  });
});

describe('размещение и стиль сигналов', () => {
  it('привязка к сетке и центрирование под курсором', () => {
    expect(snapPoint({ x: 14, y: 26 })).toEqual({ x: 10, y: 30 });
    expect(placementPosition({ x: 100, y: 100 })).toEqual({ x: 60, y: 70 });
  });

  it('цвета 0, 1 и X различимы', () => {
    expect([signalTone(0), signalTone(1), signalTone('X')]).toEqual(['low', 'high', 'unknown']);
    expect(new Set(Object.values(SIGNAL_COLORS)).size).toBe(3);
    expect(signalColor(1)).toBe(SIGNAL_COLORS.high);
  });
});

describe('путь провода-петли', () => {
  it('проходит над элементом и подходит к входу слева', () => {
    // Выход (80, 20), вход (0, 20), верх элемента y = 0.
    expect(selfLoopPath(80, 20, 0, 20, 0)).toBe(
      `M 80 20 H ${80 + SELF_LOOP_MARGIN} V ${-SELF_LOOP_MARGIN} H ${-SELF_LOOP_MARGIN} V 20 H 0`,
    );
  });
});

describe('палитра', () => {
  it('группирует элементы по категориям в порядке реестра', () => {
    const groups = groupElements(createDefaultRegistry().list());
    expect(groups.map((g) => [g.title, g.items.map((d) => d.type)])).toEqual([
      ['Ввод и вывод', ['INPUT', 'OUTPUT']],
      ['Логические вентили', ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR']],
    ]);
  });
});
