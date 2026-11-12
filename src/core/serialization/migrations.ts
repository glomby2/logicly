import type { FileError } from './errors';
import { CURRENT_VERSION } from './format';

export type RawDocument = Readonly<Record<string, unknown>>;

/** Переводит документ версии N в версию N + 1. Возвращает новый объект. */
export type Migration = (document: RawDocument) => RawDocument;

/**
 * Миграции по исходной версии: `MIGRATIONS[1]` переводит версию 1 в 2 и т.д.
 * Пока формат существует в одной версии, цепочка пуста.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export type MigrationResult =
  | { readonly ok: true; readonly document: RawDocument }
  | { readonly ok: false; readonly error: FileError };

export interface MigrationOptions {
  readonly migrations?: Readonly<Record<number, Migration>>;
  readonly currentVersion?: number;
}

/**
 * Проверяет поле `version` и применяет миграции по порядку до текущей версии.
 * Версия новее поддерживаемой — ошибка: такой файл создан более новой программой.
 */
export function migrateToCurrent(
  document: RawDocument,
  { migrations = MIGRATIONS, currentVersion = CURRENT_VERSION }: MigrationOptions = {},
): MigrationResult {
  if (!('version' in document)) return { ok: false, error: { code: 'missing-field', path: 'version' } };
  const version = document.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: { code: 'invalid-version', path: 'version', detail: String(version) } };
  }
  if (version > currentVersion) {
    return { ok: false, error: { code: 'unsupported-version', path: 'version', detail: String(version) } };
  }

  let current = document;
  for (let from = version; from < currentVersion; from++) {
    const migrate = migrations[from];
    // Пропуск в цепочке — ошибка программы; файл открыть нельзя.
    if (!migrate) return { ok: false, error: { code: 'unsupported-version', path: 'version', detail: String(version) } };
    current = { ...migrate(current), version: from + 1 };
  }
  return { ok: true, document: current };
}
