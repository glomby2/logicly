import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { CURRENT_VERSION, MIGRATIONS, migrateToCurrent, parseCircuitFile, type Migration } from '@/core/serialization';
import { toText, validDocument } from '../../helpers/files';

describe('миграции формата', () => {
  it('текущая версия проходит без изменений', () => {
    const document = validDocument();
    const result = migrateToCurrent(document);
    expect(result).toEqual({ ok: true, document });
  });

  it('для каждой версии до текущей есть миграция', () => {
    for (let version = 1; version < CURRENT_VERSION; version++) expect(MIGRATIONS[version]).toBeTypeOf('function');
  });

  it('цепочка применяется по порядку и обновляет version', () => {
    const calls: number[] = [];
    const migrations: Record<number, Migration> = {
      1: (doc) => (calls.push(1), { ...doc, step1: true }),
      2: (doc) => (calls.push(2), { ...doc, step2: doc.step1 === true }),
    };
    const result = migrateToCurrent({ version: 1 }, { migrations, currentVersion: 3 });
    expect(calls).toEqual([1, 2]);
    expect(result).toEqual({ ok: true, document: { version: 3, step1: true, step2: true } });

    calls.length = 0;
    migrateToCurrent({ version: 2 }, { migrations, currentVersion: 3 });
    expect(calls).toEqual([2]);
  });

  it('пропуск в цепочке — версия не поддерживается', () => {
    const result = migrateToCurrent({ version: 1 }, { migrations: {}, currentVersion: 2 });
    expect(result).toEqual({ ok: false, error: { code: 'unsupported-version', path: 'version', detail: '1' } });
  });

  it('версия новее текущей отклоняется', () => {
    expect(migrateToCurrent({ version: CURRENT_VERSION + 1 })).toMatchObject({
      ok: false,
      error: { code: 'unsupported-version' },
    });
  });

  it('parseCircuitFile применяет миграции до проверки структуры', () => {
    // Условная «версия 0»: элементы назывались `parts`.
    const old = { ...validDocument(), version: 1, parts: validDocument().components, components: undefined };
    const migrations: Record<number, Migration> = {
      1: ({ parts, ...rest }) => ({ ...rest, components: parts }),
    };
    const result = parseCircuitFile(toText(old), createDefaultRegistry(), { migrations, currentVersion: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.circuit.components).toHaveLength(3);
  });
});
