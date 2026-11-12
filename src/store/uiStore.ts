import { createStore, type StoreApi } from 'zustand/vanilla';
import type { CircuitFragment } from '@/core/circuit';
import type { FileWarning } from '@/core/serialization';
import type { Circuit, ComponentId, WireId } from '@/core/types/circuit';
import { pushNotification, type AppNotification, type NotificationTone } from './notifications';

export interface Selection {
  readonly components: readonly ComponentId[];
  readonly wires: readonly WireId[];
}

export type PanelId = 'palette' | 'inspector';
export type ThemePreference = 'system' | 'light' | 'dark';
export type DialogId = 'shortcuts' | 'truth-table' | 'discard-changes';

/** Документ, который откроется после подтверждения потери несохранённых изменений. */
export type PendingDocument =
  | { readonly kind: 'new' }
  | {
      readonly kind: 'open';
      readonly circuit: Circuit;
      readonly name: string;
      readonly warnings: readonly FileWarning[];
    };

export interface UiStoreState {
  readonly selection: Selection;
  readonly panels: Readonly<Record<PanelId, boolean>>;
  readonly theme: ThemePreference;
  readonly dialog: DialogId | null;
  /** Тип элемента, выбранного в палитре для размещения тапом по полю (тач-устройства). */
  readonly placement: string | null;
  /** Скопированный фрагмент схемы и число вставок из него (для смещения каждой следующей копии). */
  readonly clipboard: CircuitFragment | null;
  readonly pasteCount: number;
  /** Ограниченная очередь уведомлений без повторов. */
  readonly notifications: readonly AppNotification[];
  /** Ожидает подтверждения в диалоге `discard-changes`. Закрытие диалога его сбрасывает. */
  readonly pendingDocument: PendingDocument | null;

  select(selection: Partial<Selection>): void;
  clearSelection(): void;
  /** Убирает из выделения элементы и провода, которых больше нет в схеме. */
  pruneSelection(circuit: Circuit): void;
  setPanel(panel: PanelId, open: boolean): void;
  togglePanel(panel: PanelId): void;
  setTheme(theme: ThemePreference): void;
  openDialog(dialog: DialogId): void;
  /** Закрывает диалог и отменяет ожидающий документ. */
  closeDialog(): void;
  /** Открывает диалог подтверждения для документа, который заменит текущий. */
  confirmDiscard(pending: PendingDocument): void;
  startPlacement(type: string): void;
  cancelPlacement(): void;
  setClipboard(fragment: CircuitFragment): void;
  /** Увеличивает счётчик вставок и возвращает его новое значение. */
  notePaste(): number;
  notify(message: string, tone?: NotificationTone): void;
  dismissNotification(id: number): void;
}

export type UiStore = StoreApi<UiStoreState>;

export const EMPTY_SELECTION: Selection = { components: [], wires: [] };

export function createUiStore(): UiStore {
  let nextNotificationId = 1;
  return createStore<UiStoreState>()((set, get) => ({
    selection: EMPTY_SELECTION,
    panels: { palette: true, inspector: true },
    theme: 'system',
    dialog: null,
    placement: null,
    clipboard: null,
    pasteCount: 0,
    notifications: [],
    pendingDocument: null,

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
    closeDialog: () => set({ dialog: null, pendingDocument: null }),
    confirmDiscard: (pending) => set({ dialog: 'discard-changes', pendingDocument: pending }),
    startPlacement: (type) => set({ placement: type }),
    cancelPlacement: () => set({ placement: null }),
    setClipboard: (fragment) => set({ clipboard: fragment, pasteCount: 0 }),
    notePaste() {
      const pasteCount = get().pasteCount + 1;
      set({ pasteCount });
      return pasteCount;
    },
    notify(message, tone = 'info') {
      set({ notifications: pushNotification(get().notifications, message, tone, nextNotificationId++) });
    },
    dismissNotification(id) {
      const notifications = get().notifications.filter((n) => n.id !== id);
      if (notifications.length !== get().notifications.length) set({ notifications });
    },
  }));
}

export const selectIsSelected = (state: UiStoreState, id: ComponentId) => state.selection.components.includes(id);
