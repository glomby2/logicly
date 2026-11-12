import { ACCEPTED_EXTENSIONS, FILE_EXTENSION, MAX_DOCUMENT_NAME_LENGTH } from './format';

const extensionOf = (fileName: string) => {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot).toLowerCase();
};

/** Можно ли открыть файл с таким именем: `.lsim` или `.json`, регистр не важен. */
export function isSupportedFileName(fileName: string): boolean {
  return ACCEPTED_EXTENSIONS.includes(extensionOf(fileName));
}

/** Имя файла без поддерживаемого расширения — название документа по умолчанию. */
export function baseName(fileName: string): string {
  return isSupportedFileName(fileName) ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
}

// Символы, недопустимые в именах файлов Windows, и управляющие символы.
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * Имя скачиваемого файла по названию документа: недопустимые символы заменены пробелами,
 * точки и пробелы по краям убраны (Windows их не сохраняет), длина ограничена.
 * Пустое название заменяется на `fallback`.
 */
export function toFileName(name: string, fallback: string): string {
  const clean = (value: string) =>
    value
      .replace(FORBIDDEN, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, MAX_DOCUMENT_NAME_LENGTH)
      .replace(/^[\s.]+|[\s.]+$/g, '');
  let base = clean(name) || clean(fallback) || 'circuit';
  if (RESERVED.test(base)) base = `_${base}`;
  return `${base}${FILE_EXTENSION}`;
}
