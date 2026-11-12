import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  addComponent,
  carryInteractiveProps,
  changedPropKeys,
  circuitsEqual,
  classifyChange,
  connect,
  findComponent,
  insertFragment,
  instantiateFragment,
  reconnect as reconnectWire,
  removeComponents,
  removeWires,
  updateComponentProps,
  type CircuitChange,
  type CircuitFragment,
  type ConnectionCheck,
} from '@/core/circuit';
import type { ElementRegistry } from '@/core/elements';
import { normalizeDocumentName } from '@/core/serialization';
import {
  EMPTY_CIRCUIT,
  type Circuit,
  type ComponentId,
  type ElementProps,
  type PinRef,
  type Point,
  type WireId,
} from '@/core/types/circuit';
import { createId as defaultCreateId } from '@/lib/id';
import {
  emptyHistory,
  recordHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
  type HistoryStep,
} from './history';

export interface ComponentMove {
  readonly id: ComponentId;
  readonly position: Point;
}

export interface RemoveItems {
  readonly components?: Iterable<ComponentId>;
  readonly wires?: Iterable<WireId>;
}

export interface LoadOptions {
  /** Название документа; по умолчанию пустое (интерфейс показывает «Без названия»). */
  readonly name?: string;
  /**
   * Совпадает ли загруженная схема с файлом на диске. `false` — схема была исправлена
   * при загрузке, и индикатор несохранённых изменений должен гореть. По умолчанию `true`.
   */
  readonly saved?: boolean;
}

export interface CircuitStoreState {
  /** Схема — то, что сохраняется в файл. Вычисленные сигналы здесь не хранятся. */
  readonly circuit: Circuit;
  /** Название документа. Сохраняется в файл, но не в историю undo/redo. */
  readonly name: string;
  /** Схема на момент последнего сохранения или загрузки; `null` — не совпадает ни с одним файлом. */
  readonly savedCircuit: Circuit | null;
  /** Название на момент последнего сохранения или загрузки. */
  readonly savedName: string;
  /** Загрузка или очистка документа: симуляция начинается заново. */
  readonly documentVersion: number;
  /** Изменение топологии или набора пинов: нужна перекомпиляция netlist. */
  readonly structureVersion: number;
  /** Изменение свойств без смены пинов: достаточно `engine.setProps()`. */
  readonly propsVersion: number;
  readonly history: HistoryState<Circuit>;
  /** Снимок на момент `beginBatch()`; пока группа открыта, история не пополняется. */
  readonly batchStart: Circuit | null;

  addComponent(type: string, position: Point, props?: ElementProps, label?: string): ComponentId;
  moveComponents(moves: readonly ComponentMove[]): void;
  /** Пустая подпись удаляет её. */
  renameComponent(id: ComponentId, label: string): void;
  updateProps(id: ComponentId, patch: ElementProps): void;
  /** Соединяет два пина в любом порядке. Возвращает результат проверки — UI может показать причину отказа. */
  connect(a: PinRef, b: PinRef): ConnectionCheck;
  /** Переподключает провод к другим пинам, сохраняя его id. Недопустимое соединение ничего не меняет. */
  reconnect(wireId: WireId, a: PinRef, b: PinRef): ConnectionCheck;
  /** Вставляет копию фрагмента с новыми id и смещением — одним шагом истории. Возвращает вставленное. */
  insertFragment(fragment: CircuitFragment, offset: Point): CircuitFragment;
  remove(items: RemoveItems): void;
  /** Новый документ: история очищается, симуляция начинается с состояния включения. */
  loadCircuit(circuit: Circuit, options?: LoadOptions): void;
  /** Новый пустой документ без названия. */
  clear(): void;
  /** Переименовывает документ. Не записывается в историю и не затрагивает симуляцию. */
  renameDocument(name: string): void;
  /** Текущая схема и название сохранены в файл: индикатор несохранённых изменений гаснет. */
  markSaved(): void;
  undo(): void;
  redo(): void;
  /** Группирует последующие изменения в один шаг истории (например, перетаскивание). */
  beginBatch(): void;
  endBatch(): void;
}

export type CircuitStore = StoreApi<CircuitStoreState>;

export interface CircuitStoreOptions {
  readonly registry: ElementRegistry;
  readonly createId?: (prefix: string) => string;
  readonly historyLimit?: number;
}

const versionBumps = (change: CircuitChange) => ({
  structure: change === 'structure' ? 1 : 0,
  props: change === 'props' ? 1 : 0,
});

export function createCircuitStore({
  registry,
  createId = defaultCreateId,
  historyLimit,
}: CircuitStoreOptions): CircuitStore {
  return createStore<CircuitStoreState>()((set, get) => {
    /** Применяет новую схему, увеличивает нужные версии и при необходимости пишет историю. */
    const commit = (next: Circuit, record = true) => {
      const state = get();
      if (next === state.circuit) return;
      const bump = versionBumps(classifyChange(state.circuit, next, registry));
      const writeHistory = record && state.batchStart === null;
      set({
        circuit: next,
        structureVersion: state.structureVersion + bump.structure,
        propsVersion: state.propsVersion + bump.props,
        history: writeHistory ? recordHistory(state.history, state.circuit, historyLimit) : state.history,
      });
    };

    const uniqueId = (prefix: string, taken: (id: string) => boolean) => {
      let id: string;
      do id = createId(prefix);
      while (taken(id));
      return id;
    };

    /** Переход по истории: интерактивные свойства берутся из текущей схемы. */
    const travel = (step: HistoryStep<Circuit> | undefined) => {
      const state = get();
      if (!step || state.batchStart !== null) return;
      const next = carryInteractiveProps(step.snapshot, state.circuit, registry);
      const bump = versionBumps(classifyChange(state.circuit, next, registry));
      set({
        circuit: next,
        history: step.history,
        structureVersion: state.structureVersion + bump.structure,
        propsVersion: state.propsVersion + bump.props,
      });
    };

    const load = (circuit: Circuit, { name = '', saved = true }: LoadOptions = {}) => {
      const state = get();
      const documentName = normalizeDocumentName(name);
      set({
        circuit,
        name: documentName,
        savedCircuit: saved ? circuit : null,
        savedName: documentName,
        documentVersion: state.documentVersion + 1,
        structureVersion: state.structureVersion + 1,
        history: emptyHistory(),
        batchStart: null,
      });
    };

    return {
      circuit: EMPTY_CIRCUIT,
      name: '',
      savedCircuit: EMPTY_CIRCUIT,
      savedName: '',
      documentVersion: 0,
      structureVersion: 0,
      propsVersion: 0,
      history: emptyHistory(),
      batchStart: null,

      addComponent(type, position, props = {}, label) {
        const { circuit } = get();
        const id = uniqueId(type.toLowerCase(), (candidate) => !!findComponent(circuit, candidate));
        commit(addComponent(circuit, registry, { id, type, position, props, ...(label ? { label } : {}) }));
        return id;
      },

      moveComponents(moves) {
        const targets = new Map(moves.map((move) => [move.id, move.position]));
        const { circuit } = get();
        let moved = false;
        const components = circuit.components.map((component) => {
          const position = targets.get(component.id);
          if (!position || (position.x === component.position.x && position.y === component.position.y)) {
            return component;
          }
          moved = true;
          return { ...component, position };
        });
        if (moved) commit({ ...circuit, components });
      },

      renameComponent(id, label) {
        const { circuit } = get();
        const component = findComponent(circuit, id);
        const trimmed = label.trim();
        if (!component || (component.label ?? '') === trimmed) return;
        const renamed = { ...component, label: trimmed || undefined };
        commit({ ...circuit, components: circuit.components.map((c) => (c.id === id ? renamed : c)) });
      },

      updateProps(id, patch) {
        const { circuit } = get();
        const component = findComponent(circuit, id);
        if (!component) return;
        const next = updateComponentProps(circuit, registry, id, patch);
        const updated = findComponent(next, id)!;
        const keys = changedPropKeys(component.props, updated.props);
        if (keys.length === 0) return;
        const interactive = registry.get(component.type)?.interactiveProps ?? [];
        commit(next, !keys.every((key) => interactive.includes(key)));
      },

      connect(a, b) {
        const { circuit } = get();
        const wireId = uniqueId('w', (candidate) => circuit.wires.some((w) => w.id === candidate));
        const result = connect(circuit, registry, a, b, wireId);
        if (result.check.ok) commit(result.circuit);
        return result.check;
      },

      reconnect(wireId, a, b) {
        const result = reconnectWire(get().circuit, registry, wireId, a, b);
        if (result.check.ok) commit(result.circuit);
        return result.check;
      },

      insertFragment(fragment, offset) {
        const { circuit } = get();
        const taken = new Set([...circuit.components.map((c) => c.id), ...circuit.wires.map((w) => w.id)]);
        const fresh = instantiateFragment(
          fragment,
          (prefix) => {
            const id = uniqueId(prefix, (candidate) => taken.has(candidate));
            taken.add(id);
            return id;
          },
          offset,
        );
        const next = insertFragment(circuit, registry, fresh);
        commit(next);
        const insertedWires = new Set(next.wires.map((w) => w.id));
        return { components: fresh.components, wires: fresh.wires.filter((w) => insertedWires.has(w.id)) };
      },

      remove({ components = [], wires = [] }) {
        const { circuit } = get();
        const next = removeWires(removeComponents(circuit, components), wires);
        const unchanged =
          next.components.length === circuit.components.length && next.wires.length === circuit.wires.length;
        if (!unchanged) commit(next);
      },

      loadCircuit: load,
      clear: () => load(EMPTY_CIRCUIT),

      renameDocument(name) {
        const next = normalizeDocumentName(name);
        if (next !== get().name) set({ name: next });
      },

      markSaved() {
        const { circuit, name } = get();
        set({ savedCircuit: circuit, savedName: name });
      },

      undo: () => travel(undoHistory(get().history, get().circuit)),
      redo: () => travel(redoHistory(get().history, get().circuit)),

      beginBatch() {
        if (get().batchStart === null) set({ batchStart: get().circuit });
      },

      endBatch() {
        const { batchStart, circuit, history } = get();
        if (batchStart === null) return;
        set({
          batchStart: null,
          history: batchStart === circuit ? history : recordHistory(history, batchStart, historyLimit),
        });
      },
    };
  });
}

export const selectCanUndo = (state: CircuitStoreState) => state.history.past.length > 0 && state.batchStart === null;
export const selectCanRedo = (state: CircuitStoreState) => state.history.future.length > 0 && state.batchStart === null;

/**
 * Есть ли несохранённые изменения. Сначала сравниваются ссылки: undo до сохранённого
 * снимка возвращает тот же объект. Если ссылки разные, сравнивается содержимое —
 * так переключение INPUT туда и обратно или возврат элемента на место не считаются правкой.
 */
export const selectIsDirty = (state: CircuitStoreState) =>
  state.savedCircuit === null || state.name !== state.savedName || !circuitsEqual(state.circuit, state.savedCircuit);
