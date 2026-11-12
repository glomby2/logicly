import { changedPropKeys } from '../circuit/diff';
import { insertFragment } from '../circuit/fragment';
import type { ElementRegistry } from '../elements/registry';
import { EMPTY_CIRCUIT, type Circuit, type CircuitComponent, type Wire } from '../types/circuit';
import type { FileError, FileWarning } from './errors';
import { FILE_FORMAT, MAX_FILE_SIZE, normalizeDocumentName } from './format';
import { migrateToCurrent, type MigrationOptions } from './migrations';
import { isPlainObject, validateDocument } from './validate';

export type ParseResult =
  | {
      readonly ok: true;
      /** Нормализованная схема: свойства через `resolveProps`, провода через `pruneInvalidWires`. */
      readonly circuit: Circuit;
      readonly name: string;
      /** Исправленные проблемы. Пустой список — файл загружен без изменений. */
      readonly warnings: readonly FileWarning[];
    }
  | { readonly ok: false; readonly errors: readonly FileError[] };

const reject = (...errors: FileError[]): ParseResult => ({ ok: false, errors });

/**
 * Разбирает текст файла схемы. Чистая функция: при любой критической ошибке
 * возвращает `ok: false` и ничего не меняет, поэтому вызывающий код загружает
 * схему только целиком.
 *
 * Стадии: размер → JSON → формат и версия (миграции) → структура и уникальность id →
 * типы элементов по реестру → нормализация существующими операциями ядра
 * (`insertFragment` = `addComponent` с `resolveProps` + `pruneInvalidWires`).
 */
export function parseCircuitFile(text: string, registry: ElementRegistry, options?: MigrationOptions): ParseResult {
  if (text.length > MAX_FILE_SIZE) return reject({ code: 'too-large' });

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return reject({ code: 'invalid-json' });
  }
  if (!isPlainObject(root)) return reject({ code: 'not-object' });
  if (!('format' in root)) return reject({ code: 'missing-field', path: 'format' });
  if (root.format !== FILE_FORMAT) return reject({ code: 'wrong-format', path: 'format', detail: String(root.format) });

  const migrated = migrateToCurrent(root, options);
  if (!migrated.ok) return reject(migrated.error);

  const validated = validateDocument(migrated.document);
  if (!validated.ok) return validated;
  const { document } = validated;

  const unknownTypes = [...new Set(document.components.map((c) => c.type))].filter((type) => !registry.has(type));
  if (unknownTypes.length > 0) return reject(...unknownTypes.map((type) => ({ code: 'unknown-type' as const, detail: type })));

  const components: CircuitComponent[] = document.components.map((c) => ({
    id: c.id,
    type: c.type,
    position: c.position,
    ...(c.label ? { label: c.label } : {}),
    props: c.props,
  }));
  const wires: Wire[] = document.wires.map((w) => ({ id: w.id, from: w.from, to: w.to }));
  const circuit = insertFragment(EMPTY_CIRCUIT, registry, { components, wires });

  const warnings: FileWarning[] = [];
  const normalized = document.components.filter(
    (raw, i) => raw.droppedProps || changedPropKeys(raw.props, circuit.components[i]!.props).length > 0,
  ).length;
  if (normalized > 0) warnings.push({ code: 'props-normalized', count: normalized });

  const invalidLabels = document.components.filter((c) => c.label === null).length;
  if (invalidLabels > 0) warnings.push({ code: 'invalid-label', count: invalidLabels });

  const removedWires = wires.length - circuit.wires.length;
  if (removedWires > 0) warnings.push({ code: 'wires-removed', count: removedWires });

  return { ok: true, circuit, name: normalizeDocumentName(document.name), warnings };
}
