import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Circuit, ComponentId, WireId } from '@/core/types/circuit';

export interface Selection {
  readonly components: readonly ComponentId[];
  readonly wires: readonly WireId[];
}

export type PanelId = 'palette' | 'inspector';
export type ThemePreference = 'system' | 'light' | 'dark';
export type DialogId = 'truth-table';

export interface UiStoreState {
  readonly selection: Selection;
  readonly panels: Readonly<Record<PanelId, boolean>>;
  readonly theme: ThemePreference;
  readonly dialog: DialogId | null;
  /** Тип элемента, выбранного в палитре для размещения тапом по полю (тач-устройства). */
  readonly placement: string | null;

  select(selection: Partial<Selection>): void;
  clearSelection(): void;
  /** Убирает из выделения элементы и провода, которых больше нет в схеме. */
  pruneSelection(circuit: Circuit): void;
  setPanel(panel: PanelId, open: boolean): void;
  togglePanel(panel: PanelId): void;
  setTheme(theme: ThemePreference): void;
  openDialog(dialog: DialogId): void;
  closeDialog(): void;
  startPlacement(type: string): void;
  cancelPlacement(): void;
}

export type UiStore = StoreApi<UiStoreState>;

export const EMPTY_SELECTION: Selection = { components: [], wires: [] };

export function createUiStore(): UiStore {
  return createStore<UiStoreState>()((set, get) => ({
    selection: EMPTY_SELECTION,
    panels: { palette: true, inspector: true },
    theme: 'system',
    dialog: null,
    placement: null,

    select: ({ components = [], wires = [] }) => set({ selection: { components, wires } }),

    clearSelection() {
      const { selection } = get();
      if (selection.components.length > 0 || selection.wires.length > 0) set({ selection: EMPTY_SELECTION });
    },

    pruneSelection(circuit) {
      const { selection } = get();
      const componentIds = new Set(circuit.components.map((c) => c.id));
      const wireIds = new Set(circuit.wires.map((w) => w.id));
      const components = selection.components.filter((id) => componentIds.has(id));
      const wires = selection.wires.filter((id) => wireIds.has(id));
      if (components.length !== selection.components.length || wires.length !== selection.wires.length) {
        set({ selection: { components, wires } });
      }
    },

    setPanel: (panel, open) => set({ panels: { ...get().panels, [panel]: open } }),
    togglePanel: (panel) => set({ panels: { ...get().panels, [panel]: !get().panels[panel] } }),
    setTheme: (theme) => set({ theme }),
    openDialog: (dialog) => set({ dialog }),
    closeDialog: () => set({ dialog: null }),
    startPlacement: (type) => set({ placement: type }),
    cancelPlacement: () => set({ placement: null }),
  }));
}

export const selectIsSelected = (state: UiStoreState, id: ComponentId) => state.selection.components.includes(id);
