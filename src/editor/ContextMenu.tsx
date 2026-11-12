import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { findComponent } from '@/core/circuit';
import type { PropSpec } from '@/core/types/element';
import { Separator } from '@/components/ui/Separator';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/cn';
import { appStores, useCircuitStore, useUiStore } from '@/store/hooks';
import { buildContextMenu, type MenuCommand, type MenuTarget } from './contextMenuModel';

export interface ContextMenuState {
  /** Позиция в координатах окна. */
  readonly x: number;
  readonly y: number;
  readonly target: MenuTarget;
}

interface ContextMenuProps {
  readonly menu: ContextMenuState;
  readonly onCommand: (command: MenuCommand, target: MenuTarget) => void;
  readonly onClose: () => void;
}

const MENU_WIDTH = 248;

/** Редактор свойства из propSchema: целое — счётчик, логическое — флажок. */
function PropControl({ componentId, spec }: { componentId: string; spec: PropSpec }) {
  const value = useCircuitStore((s) => findComponent(s.circuit, componentId)?.props[spec.key]);
  const update = (next: number | boolean) =>
    appStores.circuit.getState().updateProps(componentId, { [spec.key]: next });

  if (spec.kind === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm text-slate-200">
        {spec.label}
        <input type="checkbox" checked={value === true} onChange={(e) => update(e.target.checked)} />
      </label>
    );
  }
  const current = typeof value === 'number' ? value : spec.min;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm text-slate-200">
      <span>{spec.label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded p-1 hover:bg-slate-700 disabled:opacity-30"
          disabled={current <= spec.min}
          aria-label={`${spec.label}: −1`}
          onClick={() => update(current - 1)}
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-5 text-center font-mono" data-testid={`prop-${spec.key}`}>
          {current}
        </span>
        <button
          type="button"
          className="rounded p-1 hover:bg-slate-700 disabled:opacity-30"
          disabled={current >= spec.max}
          aria-label={`${spec.label}: +1`}
          onClick={() => update(current + 1)}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function RenameForm({ componentId, onDone }: { componentId: string; onDone: () => void }) {
  const initial = useCircuitStore((s) => findComponent(s.circuit, componentId)?.label ?? '');
  const [value, setValue] = useState(initial);
  return (
    <form
      className="px-2 py-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        appStores.circuit.getState().renameComponent(componentId, value);
        onDone();
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
        placeholder={ru.menu.renamePlaceholder}
        maxLength={24}
        className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-sky-500"
        data-testid="rename-input"
      />
    </form>
  );
}

export function ContextMenu({ menu, onCommand, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const canPaste = useUiStore((s) => s.clipboard !== null);
  const component = useCircuitStore((s) =>
    menu.target.kind === 'node' ? findComponent(s.circuit, menu.target.id) : undefined,
  );
  const definition = component ? appStores.registry.get(component.type) : undefined;
  const entries = buildContextMenu(menu.target, { canPaste, component, definition });

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [onClose]);

  // Меню не должно выходить за пределы окна.
  const left = Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(menu.y, window.innerHeight - 40 * entries.length - 8);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 rounded-lg border border-slate-700 bg-slate-900/95 py-1 shadow-xl shadow-black/40 backdrop-blur"
      style={{ left, top: Math.max(8, top), width: MENU_WIDTH }}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="context-menu"
    >
      {renaming && menu.target.kind === 'node' ? (
        <RenameForm componentId={menu.target.id} onDone={onClose} />
      ) : (
        entries.map((entry, i) => {
          if (entry.kind === 'separator') return <Separator key={i} />;
          if (entry.kind === 'prop') {
            return menu.target.kind === 'node' ? (
              <PropControl key={entry.spec.key} componentId={menu.target.id} spec={entry.spec} />
            ) : null;
          }
          return (
            <button
              key={entry.command}
              type="button"
              role="menuitem"
              disabled={entry.disabled}
              className={cn(
                'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm',
                'hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40',
                entry.danger ? 'text-rose-300' : 'text-slate-200',
              )}
              onClick={() => {
                if (entry.command === 'rename') {
                  setRenaming(true);
                  return;
                }
                onCommand(entry.command, menu.target);
                onClose();
              }}
            >
              {entry.label}
              {entry.shortcut && <kbd className="font-sans text-xs text-slate-500">{entry.shortcut}</kbd>}
            </button>
          );
        })
      )}
    </div>
  );
}
