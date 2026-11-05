import { findComponent } from '@/core/circuit';
import type { ComponentId, Point } from '@/core/types/circuit';
import type { CircuitStore } from './circuitStore';
import { EMPTY_SELECTION, type UiStore } from './uiStore';

/** Действия, затрагивающие несколько хранилищ. Компоненты интерфейса вызывают их, а не сторы по отдельности. */
export interface AppCommands {
  /** Удаляет выделенные элементы (с их проводами) и провода. */
  deleteSelection(): void;
  /** Размещает элемент, выделяет его и завершает режим размещения. */
  placeElement(type: string, position: Point): ComponentId;
  /** Переключает INPUT. Не записывается в историю undo/redo. */
  toggleInput(id: ComponentId): void;
}

export function createCommands({ circuit, ui }: { circuit: CircuitStore; ui: UiStore }): AppCommands {
  return {
    deleteSelection() {
      const { selection } = ui.getState();
      if (selection.components.length === 0 && selection.wires.length === 0) return;
      circuit.getState().remove(selection);
      ui.setState({ selection: EMPTY_SELECTION });
    },

    placeElement(type, position) {
      const id = circuit.getState().addComponent(type, position);
      ui.getState().select({ components: [id] });
      ui.getState().cancelPlacement();
      return id;
    },

    toggleInput(id) {
      const component = findComponent(circuit.getState().circuit, id);
      const value = component?.props.value;
      if (typeof value === 'boolean') circuit.getState().updateProps(id, { value: !value });
    },
  };
}
