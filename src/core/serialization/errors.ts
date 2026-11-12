/*
 * Ошибки и предупреждения при открытии файла. Ядро возвращает коды с параметрами,
 * тексты для пользователя задаются в `i18n/`.
 */

/** Критические ошибки: файл отклоняется целиком, текущая схема не меняется. */
export type FileErrorCode =
  | 'unsupported-extension'
  | 'too-large'
  | 'invalid-json'
  | 'not-object'
  | 'wrong-format'
  | 'invalid-version'
  | 'unsupported-version'
  | 'missing-field'
  | 'invalid-field'
  | 'duplicate-component-id'
  | 'duplicate-wire-id'
  | 'unknown-type';

export interface FileError {
  readonly code: FileErrorCode;
  /** Путь к полю: `components[3].position`. */
  readonly path?: string;
  /** Подробность: повторяющийся id, неизвестный тип, номер версии. */
  readonly detail?: string;
}

/** Исправимые проблемы: схема загружается в нормализованном виде. */
export type FileWarningCode =
  /** Свойства элементов исправлены: значения по умолчанию, типы, диапазоны, лишние ключи. */
  | 'props-normalized'
  /** Подписи неверного типа удалены. */
  | 'invalid-label'
  /** Провода, нарушающие правила соединений, удалены. */
  | 'wires-removed';

export interface FileWarning {
  readonly code: FileWarningCode;
  /** Число исправленных элементов или удалённых проводов. */
  readonly count: number;
}
