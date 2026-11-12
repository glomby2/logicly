import type { CircuitComponent, ComponentId, Point, WireId } from '@/core/types/circuit';
import type { ElementDefinition, PropSpec } from '@/core/types/element';
import { ru } from '@/i18n/ru';

export type MenuTarget =
  | { readonly kind: 'pane'; readonly flowPosition: Point }
  | { readonly kind: 'node'; readonly id: ComponentId }
  | { readonly kind: 'edge'; readonly id: WireId };

export type MenuCommand = 'paste' | 'selectAll' | 'fitView' | 'copy' | 'cut' | 'duplicate' | 'delete' | 'toggle' | 'rename';

export type MenuEntry =
  | {
      readonly kind: 'command';
      readonly command: MenuCommand;
      readonly label: string;
      readonly shortcut?: string;
      readonly disabled?: boolean;
      readonly danger?: boolean;
    }
  | { readonly kind: 'separator' }
  /** Редактируемое свойство элемента из `propSchema` (например, число входов). */
  | { readonly kind: 'prop'; readonly spec: PropSpec };

export interface MenuContext {
  readonly canPaste: boolean;
  /** Элемент под курсором (для меню узла). */
  readonly component?: CircuitComponent;
  readonly definition?: ElementDefinition;
}

const SEPARATOR: MenuEntry = { kind: 'separator' };

const command = (
  name: MenuCommand,
  label: string,
  extra: Omit<Extract<MenuEntry, { kind: 'command' }>, 'kind' | 'command' | 'label'> = {},
): MenuEntry => ({ kind: 'command', command: name, label, ...extra });

export function buildContextMenu(target: MenuTarget, context: MenuContext): MenuEntry[] {
  switch (target.kind) {
    case 'pane':
      return [
        command('paste', ru.menu.paste, { shortcut: 'Ctrl+V', disabled: !context.canPaste }),
        command('selectAll', ru.menu.selectAll, { shortcut: 'Ctrl+A' }),
        SEPARATOR,
        command('fitView', ru.menu.fitView),
      ];
    case 'edge':
      return [command('delete', ru.menu.deleteWire, { shortcut: 'Del', danger: true })];
    case 'node': {
      const head: MenuEntry[] = [];
      if (typeof context.component?.props.value === 'boolean') head.push(command('toggle', ru.menu.toggle));
      head.push(command('rename', ru.menu.rename));
      const props = (context.definition?.propSchema ?? []).map((spec): MenuEntry => ({ kind: 'prop', spec }));
      return [
        ...head,
        ...(props.length > 0 ? [SEPARATOR, ...props] : []),
        SEPARATOR,
        command('copy', ru.menu.copy, { shortcut: 'Ctrl+C' }),
        command('cut', ru.menu.cut, { shortcut: 'Ctrl+X' }),
        command('duplicate', ru.menu.duplicate, { shortcut: 'Ctrl+D' }),
        SEPARATOR,
        command('delete', ru.menu.delete, { shortcut: 'Del', danger: true }),
      ];
    }
  }
}
