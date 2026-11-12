/*
 * Формат файла схемы. Файл — JSON с полями `format`, `version`, `name`, `components`, `wires`.
 * Служебные поля React Flow и состояние симуляции в файл не попадают.
 * При изменении формата повышается `CURRENT_VERSION` и добавляется миграция (`migrations.ts`).
 */

/** Значение поля `format`: по нему файл схемы отличается от любого другого JSON. */
export const FILE_FORMAT = 'logic-sim';

/** Текущая версия формата. Файлы новее не открываются. */
export const CURRENT_VERSION = 1;

/** Расширение сохраняемых файлов. */
export const FILE_EXTENSION = '.lsim';

/** Расширения, которые принимаются при открытии (регистр не важен). */
export const ACCEPTED_EXTENSIONS: readonly string[] = ['.lsim', '.json'];

/** MIME-тип скачиваемого файла: содержимое — JSON. */
export const FILE_MIME_TYPE = 'application/json';

/** Максимальный размер открываемого файла, байт (для текста — символов). */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Максимальная длина названия документа. */
export const MAX_DOCUMENT_NAME_LENGTH = 100;

export interface FilePinRefV1 {
  readonly componentId: string;
  readonly pinId: string;
}

export interface FileComponentV1 {
  readonly id: string;
  readonly type: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly label?: string;
  readonly props: Readonly<Record<string, number | boolean | string>>;
}

export interface FileWireV1 {
  readonly id: string;
  readonly from: FilePinRefV1;
  readonly to: FilePinRefV1;
}

/** Содержимое файла версии 1. */
export interface CircuitFileV1 {
  readonly format: typeof FILE_FORMAT;
  readonly version: 1;
  readonly name: string;
  readonly components: readonly FileComponentV1[];
  readonly wires: readonly FileWireV1[];
}

/** Приводит название документа к допустимому виду: без пробелов по краям, с ограничением длины. */
export function normalizeDocumentName(name: string): string {
  return name.trim().slice(0, MAX_DOCUMENT_NAME_LENGTH).trim();
}
