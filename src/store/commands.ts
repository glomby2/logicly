import { extractFragment, findComponent, nextLabel, type CircuitFragment } from '@/core/circuit';
import type { ElementRegistry } from '@/core/elements';
import type { ComponentId, Point } from '@/core/types/circuit';
import type { CircuitStore } from './circuitStore';
import { EMPTY_SELECTION, type UiStore } from './uiStore';

/** Смещение каждой следующей вставки и дубликата, px. */
export const PASTE_OFFSET = 20;

/** Действия, затрагивающие несколько хранилищ. Компоненты интерфейса вызывают их, а не сторы по отдельности. */
export interface AppCommands {
  /** Удаляет выделенные элементы (с их проводами) и провода. */
  deleteSelection(): void;
  /** Размещает элемент с автоматической подписью (если она задана типом), выделяет его и завершает режим размещения. */
  placeElement(type: string, position: Point): ComponentId;
  /** Переключает INPUT. Не записывается в историю undo/redo. */
  toggleInput(id: ComponentId): void;
  selectAll(): void;
  /** Удаляет все элементы одним шагом истории (в отличие от `circuitStore.clear()`, отменяется). */
  clearAll(): void;
  /** Копирует выделенные элементы и провода между ними. Возвращает `false`, если копировать нечего. */
  copySelection(): boolean;
  cutSelection(): void;
  /** Вставляет буфер обмена. `at` — позиция левого верхнего угла; без неё — со смещением от оригинала. */
  paste(at?: Point): void;
  duplicateSelection(): void;
  /** Сдвигает выделенные элементы одним шагом истории. Не перекомпилирует схему. */
  nudgeSelection(dx: number, dy: number): void;
}

function topLeft(fragment: CircuitFragment): Point {
  return {
    x: Math.min(...fragment.components.map((c) => c.position.x)),
    y: Math.min(...fragment.components.map((c) => c.position.y)),
  };
}

export function createCommands({
  circuit,
  ui,
  registry,
}: {
  circuit: CircuitStore;
  ui: UiStore;
  registry: ElementRegistry;
}): AppCommands {
  const selectedFragment = () => extractFragment(circuit.getState().circuit, ui.getState().selection.components);

  const insert = (fragment: CircuitFragment, offset: Point) => {
    const inserted = circuit.getState().insertFragment(fragment, offset);
    ui.getState().select({
      components: inserted.components.map((c) => c.id),
      wires: inserted.wires.map((w) => w.id),
    });
  };

  const commands: AppCommands = {
    deleteSelection() {
      const { selection } = ui.getState();
      if (selection.components.length === 0 && selection.wires.length === 0) return;
      circuit.getState().remove(selection);
      ui.setState({ selection: EMPTY_SELECTION });
    },

    placeElement(type, position) {
      const prefix = registry.get(type)?.labelPrefix;
      const label = prefix ? nextLabel(circuit.getState().circuit, prefix) : undefined;
      const id = circuit.getState().addComponent(type, position, {}, label);
      ui.getState().select({ components: [id] });
      ui.getState().cancelPlacement();
      return id;
    },

    toggleInput(id) {
      const component = findComponent(circuit.getState().circuit, id);
      const value = component?.props.value;
      if (typeof value === 'boolean') circuit.getState().updateProps(id, { value: !value });
    },

    selectAll() {
      const { components, wires } = circuit.getState().circuit;
      ui.getState().select({ components: components.map((c) => c.id), wires: wires.map((w) => w.id) });
    },

    clearAll() {
      circuit.getState().remove({ components: circuit.getState().circuit.components.map((c) => c.id) });
      ui.setState({ selection: EMPTY_SELECTION });
    },

    copySelection() {
      const fragment = selectedFragment();
      if (fragment.components.length === 0) return false;
      ui.getState().setClipboard(fragment);
      return true;
    },

    cutSelection() {
      if (commands.copySelection()) commands.deleteSelection();
    },

    paste(at) {
      const { clipboard } = ui.getState();
      if (!clipboard || clipboard.components.length === 0) return;
      const count = ui.getState().notePaste();
      const origin = topLeft(clipboard);
      const offset = at
        ? { x: at.x - origin.x, y: at.y - origin.y }
        : { x: PASTE_OFFSET * count, y: PASTE_OFFSET * count };
      insert(clipboard, offset);
    },

    duplicateSelection() {
      const fragment = selectedFragment();
      if (fragment.components.length > 0) insert(fragment, { x: PASTE_OFFSET, y: PASTE_OFFSET });
    },

    nudgeSelection(dx, dy) {
      const moves = selectedFragment().components.map((c) => ({
        id: c.id,
        position: { x: c.position.x + dx, y: c.position.y + dy },
      }));
      if (moves.length > 0) circuit.getState().moveComponents(moves);
    },
  };
  return commands;
}
