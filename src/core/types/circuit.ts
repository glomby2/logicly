/*
 * Доменная модель схемы. Не зависит от React Flow: именно она сохраняется в файл
 * и передаётся движку симуляции.
 */

export type ComponentId = string;
export type WireId = string;
export type PinId = string;

/** Значение свойства элемента. Только JSON-совместимые типы. */
export type PropValue = number | boolean | string;

export type ElementProps = Readonly<Record<string, PropValue>>;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Экземпляр элемента на рабочем поле. */
export interface CircuitComponent {
  readonly id: ComponentId;
  /** Ключ определения элемента в реестре (`AND`, `INPUT`, …). */
  readonly type: string;
  readonly position: Point;
  readonly label?: string;
  readonly props: ElementProps;
}

/** Ссылка на пин конкретного элемента. */
export interface PinRef {
  readonly componentId: ComponentId;
  readonly pinId: PinId;
}

/** Провод. Всегда направлен от выхода (`from`) к входу (`to`). */
export interface Wire {
  readonly id: WireId;
  readonly from: PinRef;
  readonly to: PinRef;
}

export interface Circuit {
  readonly components: readonly CircuitComponent[];
  readonly wires: readonly Wire[];
}

export const EMPTY_CIRCUIT: Circuit = { components: [], wires: [] };
