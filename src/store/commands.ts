import { extractFragment, findComponent, nextLabel, type CircuitFragment } from '@/core/circuit';
import { switchProp, type ElementRegistry } from '@/core/elements';
import {
  baseName,
  isSupportedFileName,
  normalizeDocumentName,
  parseCircuitFile,
  serializeCircuit,
  toFileName,
  type FileError,
  type FileWarning,
} from '@/core/serialization';
import type { ComponentId, Point } from '@/core/types/circuit';
import { selectIsDirty, type CircuitStore } from './circuitStore';
import { EMPTY_SELECTION, type PendingDocument, type UiStore } from './uiStore';

/** Смещение каждой следующей вставки и дубликата, px. */
export const PASTE_OFFSET = 20;

export type OpenDocumentResult =
  /** Критическая ошибка: документ, история, название и симуляция не изменились. */
  | { readonly status: 'rejected'; readonly errors: readonly FileError[] }
  | { readonly status: 'loaded'; readonly name: string; readonly warnings: readonly FileWarning[] }
  /** Есть несохранённые изменения — открыт диалог подтверждения. */
  | { readonly status: 'pending' };

export type SaveDocumentResult =
  | { readonly ok: true; readonly fileName: string }
  | { readonly ok: false; readonly error: unknown };

/** Значение логического свойства, задающего внешний вход схемы (`port.prop` у INPUT). */
export interface InputValue {
  readonly componentId: ComponentId;
  readonly prop: string;
  readonly value: boolean;
}

/** Запускает скачивание файла. Исключение означает, что скачивание не началось. */
export type DownloadFile = (fileName: string, text: string) => void;

/** Действия, затрагивающие несколько хранилищ. Компоненты интерфейса вызывают их, а не сторы по отдельности. */
export interface AppCommands {
  /** Новый пустой документ. При несохранённых изменениях сначала открывается диалог подтверждения. */
  newDocument(): 'created' | 'pending';
  /**
   * Открывает файл: проверка расширения, разбор и проверка (`parseCircuitFile`), затем загрузка
   * целиком. При критической ошибке ничего не меняется. При несохранённых изменениях
   * разобранный документ ждёт подтверждения в диалоге.
   */
  openDocument(fileName: string, text: string): OpenDocumentResult;
  /** Применяет документ, ожидающий подтверждения. Возвращает его или `null`, если ждать было нечего. */
  confirmPendingDocument(): PendingDocument | null;
  cancelPendingDocument(): void;
  /**
   * Сериализует документ и передаёт файл в `download`. Индикатор несохранённых изменений
   * гаснет только если скачивание запустилось без ошибки. `fallbackName` — имя файла
   * для документа без названия.
   */
  saveDocument(download: DownloadFile, fallbackName: string): SaveDocumentResult;
  /** Переименовывает документ (не записывается в историю undo/redo). */
  renameDocument(name: string): void;
  /**
   * Устанавливает комбинацию на входах схемы (строка таблицы истинности): все значения
   * меняются одним изменением — один пересчёт симуляции, без записи в историю.
   */
  applyInputCombination(values: readonly InputValue[]): void;
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

  /** Заменяет документ целиком. Выделение и режим размещения сбрасываются явно: id нового документа могут совпасть со старыми. */
  const applyDocument = (pending: PendingDocument) => {
    if (pending.kind === 'new') circuit.getState().clear();
    else circuit.getState().loadCircuit(pending.circuit, { name: pending.name, saved: pending.warnings.length === 0 });
    ui.setState({ selection: EMPTY_SELECTION, placement: null, pasteCount: 0, dialog: null, pendingDocument: null });
  };

  /** Применяет документ сразу или, если текущий изменён, откладывает до подтверждения. */
  const replaceDocument = (pending: PendingDocument): boolean => {
    if (selectIsDirty(circuit.getState())) {
      ui.getState().confirmDiscard(pending);
      return false;
    }
    applyDocument(pending);
    return true;
  };

  const commands: AppCommands = {
    newDocument: () => (replaceDocument({ kind: 'new' }) ? 'created' : 'pending'),

    openDocument(fileName, text) {
      if (!isSupportedFileName(fileName)) {
        return { status: 'rejected', errors: [{ code: 'unsupported-extension', detail: fileName }] };
      }
      const result = parseCircuitFile(text, registry);
      if (!result.ok) return { status: 'rejected', errors: result.errors };
      const name = result.name || normalizeDocumentName(baseName(fileName));
      const pending: PendingDocument = { kind: 'open', circuit: result.circuit, name, warnings: result.warnings };
      return replaceDocument(pending) ? { status: 'loaded', name, warnings: result.warnings } : { status: 'pending' };
    },

    confirmPendingDocument() {
      const { pendingDocument } = ui.getState();
      if (pendingDocument) applyDocument(pendingDocument);
      return pendingDocument;
    },

    cancelPendingDocument: () => ui.getState().closeDialog(),

    saveDocument(download, fallbackName) {
      const { circuit: current, name } = circuit.getState();
      const fileName = toFileName(name, fallbackName);
      try {
        download(fileName, serializeCircuit(current, name));
      } catch (error) {
        return { ok: false, error };
      }
      circuit.getState().markSaved();
      return { ok: true, fileName };
    },

    renameDocument: (name) => circuit.getState().renameDocument(name),

    applyInputCombination(values) {
      circuit.getState().updateManyProps(values.map((v) => ({ id: v.componentId, patch: { [v.prop]: v.value } })));
    },

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
      const prop = component && switchProp(registry.get(component.type));
      if (!component || prop === undefined) return;
      const value = component.props[prop];
      if (typeof value === 'boolean') circuit.getState().updateProps(id, { [prop]: !value });
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
