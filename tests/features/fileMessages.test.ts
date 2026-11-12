import { describe, expect, it } from 'vitest';
import type { FileErrorCode, FileWarningCode } from '@/core/serialization';
import { documentTitle } from '@/features/file/useDocumentTitle';
import { loadedMessage, rejectionMessage } from '@/features/file/fileMessages';
import { ru } from '@/i18n/ru';

describe('сообщения о файлах', () => {
  it('отклонённый файл: первая причина и число остальных', () => {
    expect(rejectionMessage([{ code: 'unknown-type', detail: 'MUX' }])).toBe(
      'Файл не открыт: неизвестный тип элемента «MUX»',
    );
    expect(
      rejectionMessage([
        { code: 'missing-field', path: 'components[0].id' },
        { code: 'invalid-field', path: 'wires[1].to' },
        { code: 'invalid-field', path: 'wires[2].to' },
      ]),
    ).toBe('Файл не открыт: нет обязательного поля «components[0].id» (и ещё ошибок: 2)');
  });

  it('у каждого кода ошибки и предупреждения есть текст', () => {
    const errorCodes = Object.keys(ru.file.errors) as FileErrorCode[];
    for (const code of errorCodes) expect(ru.file.errors[code]({ code, path: 'p', detail: 'd' }).length).toBeGreaterThan(0);
    const warningCodes = Object.keys(ru.file.warnings) as FileWarningCode[];
    for (const code of warningCodes) expect(ru.file.warnings[code](2)).toContain('2');
  });

  it('открытая схема: название и исправления в одном сообщении', () => {
    expect(loadedMessage('Сумматор', [])).toBe('Открыта схема «Сумматор»');
    expect(loadedMessage('', [])).toBe('Открыта схема «Без названия»');
    expect(
      loadedMessage('x', [
        { code: 'props-normalized', count: 2 },
        { code: 'wires-removed', count: 1 },
      ]),
    ).toBe('Открыта схема «x». Исправлены свойства элементов: 2. Удалены недопустимые провода: 1');
  });

  it('заголовок вкладки', () => {
    expect(documentTitle('Сумматор', false)).toBe('Сумматор — Логический симулятор');
    expect(documentTitle('', true)).toBe('● Без названия — Логический симулятор');
  });
});
