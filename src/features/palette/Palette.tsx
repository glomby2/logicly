import { useReactFlow } from '@xyflow/react';
import { useMemo, type DragEvent } from 'react';
import type { ElementDefinition } from '@/core/types/element';
import { ELEMENT_DRAG_TYPE, placementPosition, WIDE_SCREEN } from '@/editor/placement';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/cn';
import { appStores, useUiStore } from '@/store/hooks';
import { ElementPreview } from './ElementPreview';
import { groupElements } from './paletteModel';

/** Сдвиг каждого следующего элемента, добавленного кликом, чтобы они не ложились друг на друга. */
const CLICK_STEP = 20;
const CLICK_CYCLE = 6;

export function Palette() {
  const open = useUiStore((s) => s.panels.palette);
  const groups = useMemo(() => groupElements(appStores.registry.list()), []);
  const { screenToFlowPosition } = useReactFlow();

  const placeAtCenter = (definition: ElementDefinition) => {
    const rect = document.querySelector('[data-canvas]')?.getBoundingClientRect();
    if (!rect) return;
    const step = (appStores.circuit.getState().circuit.components.length % CLICK_CYCLE) * CLICK_STEP;
    const center = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    appStores.commands.placeElement(definition.type, placementPosition({ x: center.x + step, y: center.y + step }));
    // На узком экране палитра перекрывает поле — закрываем её, чтобы был виден добавленный элемент.
    if (window.innerWidth < WIDE_SCREEN) appStores.ui.getState().setPanel('palette', false);
  };

  const onDragStart = (event: DragEvent, definition: ElementDefinition) => {
    event.dataTransfer.setData(ELEMENT_DRAG_TYPE, definition.type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside
      className={cn(
        'z-20 w-56 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900 p-3',
        // На узких экранах палитра выезжает поверх поля.
        'absolute inset-y-0 left-0 transition-transform md:static md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full md:hidden',
      )}
      aria-label={ru.palette.title}
      data-testid="palette"
    >
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{ru.palette.title}</h2>
      <p className="mb-3 text-xs leading-snug text-slate-500">{ru.palette.hint}</p>
      {groups.map((group) => (
        <section key={group.category} className="mb-4">
          <h3 className="mb-1.5 text-xs font-medium text-slate-400">{group.title}</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {group.items.map((definition) => (
              <button
                key={definition.type}
                type="button"
                draggable
                onDragStart={(event) => onDragStart(event, definition)}
                onClick={() => placeAtCenter(definition)}
                title={definition.description}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 rounded-md border border-slate-700/70 bg-slate-800/60',
                  'cursor-grab text-[11px] font-semibold tracking-wide text-slate-200 active:cursor-grabbing',
                  'hover:border-sky-500/60 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-500',
                )}
                data-testid={`palette-${definition.type}`}
              >
                <span className="flex h-8 items-center">
                  <ElementPreview definition={definition} />
                </span>
                {definition.label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
