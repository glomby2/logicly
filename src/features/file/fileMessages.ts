import type { FileError, FileWarning } from '@/core/serialization';
import { ru } from '@/i18n/ru';

/** Сообщение об отклонённом файле: первая причина и число остальных. */
export function rejectionMessage(errors: readonly FileError[]): string {
  const [first] = errors;
  const reason = first ? ru.file.errors[first.code](first) : ru.file.errors['invalid-json']();
  const more = errors.length > 1 ? ru.file.moreErrors(errors.length - 1) : '';
  return ru.file.rejected(`${reason}${more}`);
}

/** Сообщение об открытой схеме; исправления перечисляются в том же уведомлении. */
export function loadedMessage(name: string, warnings: readonly FileWarning[]): string {
  const title = ru.file.loaded(name || ru.file.untitled);
  if (warnings.length === 0) return title;
  return `${title}. ${warnings.map((w) => ru.file.warnings[w.code](w.count)).join('. ')}`;
}
