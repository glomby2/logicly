export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  | 'selectAll'
  | 'delete'
  | 'escape';

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
  return null;
}

/** Нажатия в полях ввода не должны управлять редактором. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
