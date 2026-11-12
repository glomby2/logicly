export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  | 'selectAll'
  | 'delete'
  | 'escape'
  | 'help'
  | 'save'
  | 'open';

/**
 * Действия с файлами. Их выполняет интерфейс работы с файлами (`features/file`), а не
 * редактор, и они срабатывают даже в поле ввода — иначе браузер откроет свой диалог.
 */
export function isFileShortcut(action: ShortcutAction | null): action is 'save' | 'open' {
  return action === 'save' || action === 'open';
}

export interface KeyInput {
  readonly key: string;
  /** Физическая клавиша: сочетания работают в любой раскладке, в том числе русской. */
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

const WITH_MODIFIER: Readonly<Record<string, ShortcutAction>> = {
  KeyY: 'redo',
  KeyC: 'copy',
  KeyX: 'cut',
  KeyV: 'paste',
  KeyD: 'duplicate',
  KeyA: 'selectAll',
  KeyS: 'save',
  KeyO: 'open',
};

export function resolveShortcut(input: KeyInput): ShortcutAction | null {
  if (input.altKey) return null;
  const modifier = input.ctrlKey || input.metaKey;
  if (modifier) {
    if (input.code === 'KeyZ') return input.shiftKey ? 'redo' : 'undo';
    return WITH_MODIFIER[input.code] ?? null;
  }
  if (input.key === 'Delete' || input.key === 'Backspace') return 'delete';
  if (input.key === 'Escape') return 'escape';
  // «?» проверяется по символу: в русской раскладке это Shift+7, в английской — Shift+/.
  if (input.key === 'F1' || input.key === '?') return 'help';
  return null;
}

/** Шаг перемещения стрелками: обычный — шаг сетки, с Shift — крупный. */
export const NUDGE_STEP = 10;
export const NUDGE_LARGE_STEP = 50;

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Смещение выделенного для нажатой стрелки; `null` — не стрелка или с модификатором. */
export function resolveNudge(input: KeyInput): { dx: number; dy: number } | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  const direction = ARROWS[input.key];
  if (!direction) return null;
  const step = input.shiftKey ? NUDGE_LARGE_STEP : NUDGE_STEP;
  return { dx: direction[0] * step, dy: direction[1] * step };
}

/** Нажатия в полях ввода не должны управлять редактором. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
