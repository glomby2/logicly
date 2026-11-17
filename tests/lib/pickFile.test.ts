import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickFile } from '@/lib/pickFile';

/*
 * Окружение тестов — node, без DOM. `document` подменяется минимальной заглушкой:
 * `<input type="file">` — это EventTarget с полем `files`, а «системный диалог» —
 * функции, которые выставляют файлы и присылают события в нужном порядке.
 */

class FakeFileInput extends EventTarget {
  type = '';
  accept = '';
  style: Record<string, string> = {};
  files: File[] = [];
  removed = false;
  remove() {
    this.removed = true;
  }
  click() {}
}

let input: FakeFileInput;

beforeEach(() => {
  input = new FakeFileInput();
  vi.stubGlobal('document', {
    createElement: () => input,
    body: { append: () => {} },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const file = new File(['{}'], 'scheme.lsim', { type: 'application/json' });
const fire = (type: 'change' | 'cancel') => input.dispatchEvent(new Event(type));

describe('pickFile', () => {
  it('change → cancel: возвращает выбранный файл', async () => {
    const result = pickFile('.lsim');
    input.files = [file];
    fire('change');
    fire('cancel');
    await expect(result).resolves.toBe(file);
    expect(input.removed).toBe(true);
  });

  it('cancel → change: возвращает выбранный файл (файл выставлен до cancel)', async () => {
    const result = pickFile('.lsim');
    input.files = [file];
    fire('cancel');
    fire('change');
    await expect(result).resolves.toBe(file);
    expect(input.removed).toBe(true);
  });

  it('cancel → change: возвращает выбранный файл (файл выставлен перед change)', async () => {
    const result = pickFile('.lsim');
    fire('cancel');
    input.files = [file];
    fire('change');
    await expect(result).resolves.toBe(file);
  });

  it('cancel → change в следующей микрозадаче: возвращает выбранный файл', async () => {
    const result = pickFile('.lsim');
    fire('cancel');
    await Promise.resolve();
    input.files = [file];
    fire('change');
    await expect(result).resolves.toBe(file);
  });

  it('только cancel: возвращает null и убирает input', async () => {
    const result = pickFile('.lsim');
    fire('cancel');
    await expect(result).resolves.toBeNull();
    expect(input.removed).toBe(true);
  });

  it('создаёт скрытый input с нужным accept', () => {
    void pickFile('.lsim,.json');
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.lsim,.json');
    expect(input.style.display).toBe('none');
  });
});
