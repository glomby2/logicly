import { ACCEPTED_EXTENSIONS, FILE_MIME_TYPE, MAX_FILE_SIZE } from '@/core/serialization';
import { ru } from '@/i18n/ru';
import { downloadText } from '@/lib/download';
import { pickFile } from '@/lib/pickFile';
import type { NotificationTone } from '@/store';
import { appStores } from '@/store/hooks';
import { loadedMessage, rejectionMessage } from './fileMessages';

/*
 * Действия с файлами для кнопок, диалога и горячих клавиш. Решения принимают команды
 * (`store/commands.ts`); здесь — работа с браузером (скачивание, выбор и чтение файла)
 * и уведомления.
 */

const { commands, ui } = appStores;

const ACCEPT = [...ACCEPTED_EXTENSIONS, FILE_MIME_TYPE].join(',');

const notify = (message: string, tone: NotificationTone) => ui.getState().notify(message, tone);

export function saveToFile(): void {
  const result = commands.saveDocument((fileName, text) => downloadText(fileName, text, FILE_MIME_TYPE), ru.file.untitled);
  if (result.ok) notify(ru.file.saved(result.fileName), 'info');
  else notify(ru.file.saveFailed, 'error');
}

/** Выбор файла, проверка размера, чтение и открытие. Отклонённый файл ничего не меняет. */
export async function openFromDisk(): Promise<void> {
  const file = await pickFile(ACCEPT);
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) {
    notify(rejectionMessage([{ code: 'too-large' }]), 'error');
    return;
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    notify(ru.file.readFailed, 'error');
    return;
  }
  const result = commands.openDocument(file.name, text);
  if (result.status === 'rejected') notify(rejectionMessage(result.errors), 'error');
  else if (result.status === 'loaded') notify(loadedMessage(result.name, result.warnings), result.warnings.length > 0 ? 'warning' : 'info');
}

export function createNewDocument(): void {
  commands.newDocument();
}

/** «Не сохранять» в диалоге: применяет ожидающий документ. */
export function discardAndContinue(): void {
  const applied = commands.confirmPendingDocument();
  if (applied?.kind === 'open') {
    notify(loadedMessage(applied.name, applied.warnings), applied.warnings.length > 0 ? 'warning' : 'info');
  }
}
