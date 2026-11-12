import type { PinRef, Point, PropValue } from '../types/circuit';
import type { FileError } from './errors';
import type { RawDocument } from './migrations';

/** Элемент после проверки структуры. Свойства и подпись ещё не нормализованы. */
export interface CheckedComponent {
  readonly id: string;
  readonly type: string;
  readonly position: Point;
  /** `undefined` — подписи нет; `null` — подпись была неверного типа и удалена. */
  readonly label: string | undefined | null;
  /** Значения допустимых типов. */
  readonly props: Readonly<Record<string, PropValue>>;
  /** Были ли значения свойств недопустимого типа (объект, массив, `null`). */
  readonly droppedProps: boolean;
}

export interface CheckedWire {
  readonly id: string;
  readonly from: PinRef;
  readonly to: PinRef;
}

export interface CheckedDocument {
  readonly name: string;
  readonly components: readonly CheckedComponent[];
  readonly wires: readonly CheckedWire[];
}

export type ValidationResult =
  | { readonly ok: true; readonly document: CheckedDocument }
  | { readonly ok: false; readonly errors: readonly FileError[] };

export function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function isPoint(value: unknown): value is Point {
  return isPlainObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isPropValue(value: unknown): value is PropValue {
  return typeof value === 'boolean' || typeof value === 'string' || isFiniteNumber(value);
}

/**
 * Проверяет структуру документа текущей версии. Все критические ошибки собираются сразу,
 * чтобы пользователь увидел их полный список. Тип элементов и правила соединений
 * здесь не проверяются — это делает `parse.ts` с помощью реестра.
 */
export function validateDocument(document: RawDocument): ValidationResult {
  const errors: FileError[] = [];
  const missing = (path: string) => errors.push({ code: 'missing-field', path });
  const invalid = (path: string) => errors.push({ code: 'invalid-field', path });

  /** Обязательное поле: отсутствует — `missing-field`, есть, но не проходит проверку — `invalid-field`. */
  function field<T>(source: Readonly<Record<string, unknown>>, key: string, path: string, check: (v: unknown) => v is T) {
    if (!(key in source)) {
      missing(path);
      return undefined;
    }
    const value = source[key];
    if (!check(value)) {
      invalid(path);
      return undefined;
    }
    return value;
  }

  function pinRef(source: Readonly<Record<string, unknown>>, key: string, path: string): PinRef | undefined {
    const value = field(source, key, path, isPlainObject);
    if (!value) return undefined;
    const componentId = field(value, 'componentId', `${path}.componentId`, isNonEmptyString);
    const pinId = field(value, 'pinId', `${path}.pinId`, isNonEmptyString);
    return componentId !== undefined && pinId !== undefined ? { componentId, pinId } : undefined;
  }

  const name = field(document, 'name', 'name', (v): v is string => typeof v === 'string');
  const rawComponents = field(document, 'components', 'components', Array.isArray);
  const rawWires = field(document, 'wires', 'wires', Array.isArray);

  const components: CheckedComponent[] = [];
  (rawComponents ?? []).forEach((raw: unknown, i) => {
    const path = `components[${i}]`;
    if (!isPlainObject(raw)) {
      invalid(path);
      return;
    }
    const id = field(raw, 'id', `${path}.id`, isNonEmptyString);
    const type = field(raw, 'type', `${path}.type`, isNonEmptyString);
    const position = field(raw, 'position', `${path}.position`, isPoint);
    const props = field(raw, 'props', `${path}.props`, isPlainObject);
    if (id === undefined || type === undefined || position === undefined || props === undefined) return;

    const validProps = Object.entries(props).filter(([, value]) => isPropValue(value));
    const label = raw.label === undefined || raw.label === '' ? undefined : typeof raw.label === 'string' ? raw.label : null;
    components.push({
      id,
      type,
      // Только координаты: лишние поля позиции в схему не попадают.
      position: { x: position.x, y: position.y },
      label,
      props: Object.fromEntries(validProps) as Record<string, PropValue>,
      droppedProps: validProps.length !== Object.keys(props).length,
    });
  });

  const wires: CheckedWire[] = [];
  (rawWires ?? []).forEach((raw: unknown, i) => {
    const path = `wires[${i}]`;
    if (!isPlainObject(raw)) {
      invalid(path);
      return;
    }
    const id = field(raw, 'id', `${path}.id`, isNonEmptyString);
    const from = pinRef(raw, 'from', `${path}.from`);
    const to = pinRef(raw, 'to', `${path}.to`);
    if (id !== undefined && from && to) wires.push({ id, from, to });
  });

  if (errors.length === 0) {
    errors.push(...duplicates(components, 'duplicate-component-id'), ...duplicates(wires, 'duplicate-wire-id'));
  }
  if (errors.length > 0 || name === undefined) return { ok: false, errors };
  return { ok: true, document: { name, components, wires } };
}

function duplicates(items: readonly { readonly id: string }[], code: FileError['code']): FileError[] {
  const seen = new Set<string>();
  const reported = new Set<string>();
  const errors: FileError[] = [];
  for (const { id } of items) {
    if (seen.has(id) && !reported.has(id)) {
      reported.add(id);
      errors.push({ code, detail: id });
    }
    seen.add(id);
  }
  return errors;
}
