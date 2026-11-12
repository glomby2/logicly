import { describe, expect, it } from 'vitest';
import { baseName, isSupportedFileName, MAX_DOCUMENT_NAME_LENGTH, toFileName } from '@/core/serialization';

describe('имена файлов', () => {
  it('открываются .lsim и .json в любом регистре', () => {
    expect(isSupportedFileName('схема.lsim')).toBe(true);
    expect(isSupportedFileName('СХЕМА.LSIM')).toBe(true);
    expect(isSupportedFileName('a.b.json')).toBe(true);
    expect(isSupportedFileName('a.txt')).toBe(false);
    expect(isSupportedFileName('lsim')).toBe(false);
    expect(isSupportedFileName('a.lsim.txt')).toBe(false);
  });

  it('название по имени файла — без расширения', () => {
    expect(baseName('Полусумматор.lsim')).toBe('Полусумматор');
    expect(baseName('a.b.JSON')).toBe('a.b');
    expect(baseName('readme.txt')).toBe('readme.txt');
  });

  it('имя скачиваемого файла: расширение .lsim, без недопустимых символов', () => {
    expect(toFileName('Полусумматор', 'Без названия')).toBe('Полусумматор.lsim');
    expect(toFileName('a/b\\c:d*e?f"g<h>i|j', 'x')).toBe('a b c d e f g h i j.lsim');
    expect(toFileName('  ..имя.. ', 'x')).toBe('имя.lsim');
    expect(toFileName('строка\nвторая\tтаб', 'x')).toBe('строка вторая таб.lsim');
  });

  it('пустое название заменяется запасным', () => {
    expect(toFileName('', 'Без названия')).toBe('Без названия.lsim');
    expect(toFileName(' ///  ', 'Без названия')).toBe('Без названия.lsim');
    expect(toFileName('', '')).toBe('circuit.lsim');
  });

  it('зарезервированные имена Windows и длина', () => {
    expect(toFileName('CON', 'x')).toBe('_CON.lsim');
    expect(toFileName('com1', 'x')).toBe('_com1.lsim');
    expect(toFileName('я'.repeat(300), 'x')).toBe(`${'я'.repeat(MAX_DOCUMENT_NAME_LENGTH)}.lsim`);
  });
});
