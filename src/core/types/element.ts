import type { Signal } from '../logic/signal';
import type { ElementProps, PinId } from './circuit';

export type PinDirection = 'input' | 'output';

/** Сторона символа, на которой рисуется пин. По умолчанию входы слева, выходы справа. */
export type PinSide = 'left' | 'right' | 'top' | 'bottom';

export interface PinSpec {
  readonly id: PinId;
  /** Подпись пина на символе (`D`, `CLK`, `Q`). Для вентилей не нужна. */
  readonly label?: string;
  readonly side?: PinSide;
  /** Тактовый (динамический) вход: на символе отмечается значком ▷. */
  readonly clock?: boolean;
}

export interface ElementPins {
  readonly inputs: readonly PinSpec[];
  readonly outputs: readonly PinSpec[];
}

export type ElementCategory = 'io' | 'gates' | 'combinational' | 'sequential';

/** Описание редактируемого свойства для инспектора. */
export type PropSpec =
  | {
      readonly key: string;
      readonly label: string;
      readonly kind: 'integer';
      readonly min: number;
      readonly max: number;
    }
  | {
      readonly key: string;
      readonly label: string;
      readonly kind: 'boolean';
    };

/**
 * Роль элемента как внешнего вывода схемы — для анализа (таблицы истинности):
 * - `input` — источник сигнала, который задаётся логическим свойством `prop`
 *   (единственный выход равен 1, когда свойство истинно);
 * - `output` — индикатор; его значение — сигнал на первом входе.
 * Анализ находит входы и выходы схемы по этой роли, а не по типу элемента.
 */
export type ElementPort =
  | { readonly kind: 'input'; readonly prop: string }
  | { readonly kind: 'output' };

export interface EvalContext<P, S> {
  /** Значения входов в порядке `pins().inputs`. Неподключённый вход равен 0. */
  readonly inputs: readonly Signal[];
  readonly props: P;
  readonly state: S;
}

export interface EvalResult<S> {
  /** Значения выходов в порядке `pins().outputs`. */
  readonly outputs: readonly Signal[];
  /** Новое внутреннее состояние; отсутствует — состояние не изменилось. */
  readonly state?: S;
}

export interface TickContext<P, S> {
  readonly props: P;
  readonly state: S;
  readonly time: number;
}

/**
 * Определение типа элемента. Новый элемент — новый объект этого типа,
 * зарегистрированный в реестре; движок, палитра и сериализация работают через реестр.
 *
 * Требования к `evaluate`: детерминированность, монотонность по X
 * (замена входа на X не может сменить 0 на 1 или наоборот), число выходов
 * совпадает с `pins().outputs`.
 */
export interface ElementDefinition<P extends ElementProps = ElementProps, S = unknown> {
  readonly type: string;
  /** Международное название: AND, MUX, D FLIP-FLOP. */
  readonly label: string;
  /** Описание на русском для подсказок в интерфейсе. */
  readonly description: string;
  readonly category: ElementCategory;
  readonly defaultProps: P;
  readonly propSchema?: readonly PropSpec[];
  /**
   * Свойства, которые пользователь меняет при работе со схемой, а не при её редактировании
   * (положение переключателя INPUT). Их изменения не попадают в историю undo/redo,
   * а при отмене сохраняется их текущее значение.
   */
  readonly interactiveProps?: readonly string[];
  /** Префикс автоматической подписи нового экземпляра: `X` → X1, X2, … Без префикса подписи нет. */
  readonly labelPrefix?: string;
  /** Внешний вход или выход схемы (INPUT, OUTPUT). Используется таблицей истинности. */
  readonly port?: ElementPort;
  pins(props: P): ElementPins;
  initialState?(props: P): S;
  /**
   * Состояние с неизвестным содержимым памяти (Q = X) — для анализа: таблица истинности
   * считает от него, и выход, зависящий от прошлого, получает «↺». Выходы из этого
   * состояния не определённее выходов из любого достижимого состояния (проверяет
   * контрактный тест). Без него элемент анализируется от `initialState`.
   */
  unknownState?(props: P): S;
  evaluate(context: EvalContext<P, S>): EvalResult<S>;
  /** Реакция на шаг времени (CLOCK). Возвращает новое состояние. */
  onTick?(context: TickContext<P, S>): S;
}
