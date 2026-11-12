import { useEffect, useRef, useState } from 'react';
import { findComponent } from '@/core/circuit';
import { Separator } from '@/components/ui/Separator';
import { cn } from '@/lib/cn';
import { appStores, useCircuitStore, useUiStore } from '@/store/hooks';
import { ComponentLabelField, ComponentPropField } from './ComponentFields';
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
        <div className="px-2 py-1.5">
          <ComponentLabelField componentId={menu.target.id} autoFocus onFinish={onClose} testId="rename-input" />
        </div>
      ) : (
        entries.map((entry, i) => {
          if (entry.kind === 'separator') return <Separator key={i} />;
          if (entry.kind === 'prop') {
            return menu.target.kind === 'node' ? (
              <ComponentPropField
                key={entry.spec.key}
                componentId={menu.target.id}
                spec={entry.spec}
                className="px-3 py-1.5"
              />
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
