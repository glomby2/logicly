import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRegistry } from '@/core/elements';
import { parseCircuitFile, serializeCircuit } from '@/core/serialization';
import { selectCanUndo, selectIsDirty } from '@/store';
import { norLatch } from '../helpers/circuits';
import { normalized, toText, validDocument } from '../helpers/files';
import { TEST_CLOCK } from '../helpers/fixtureElements';
import { createTestApp, inp, out } from '../helpers/stores';

const FALLBACK = 'Без названия';

function setup() {
  const registry = createDefaultRegistry();
  registry.register(TEST_CLOCK);
  const t = createTestApp({ registry });
  const ui = () => t.app.ui.getState();
  const dirty = () => selectIsDirty(t.circuit());
  return { ...t, registry, ui, dirty, commands: t.app.commands };
}

/** Текущий документ с несохранёнными изменениями. */
function edited(t: ReturnType<typeof setup>) {
  const a = t.circuit().addComponent('INPUT', { x: 0, y: 0 });
  const g = t.circuit().addComponent('AND', { x: 100, y: 0 });
  t.circuit().connect(out(a), inp(g));
  t.circuit().renameDocument('Текущая');
  t.ui().select({ components: [a] });
  return { a, g };
}

/** Всё, что не должна менять отклонённая загрузка. */
function snapshot(t: ReturnType<typeof setup>) {
  const c = t.circuit();
  const s = t.simulation();
  return {
    circuit: c.circuit,
    history: c.history,
    name: c.name,
    savedCircuit: c.savedCircuit,
    savedName: c.savedName,
    versions: [c.documentVersion, c.structureVersion, c.propsVersion],
    simulation: [s.compilations, s.time, s.signals, s.running],
    selection: t.ui().selection,
    dialog: t.ui().dialog,
  };
}

const latchText = (name = 'RS-защёлка') =>
  serializeCircuit(normalized(norLatch().build(), createDefaultRegistry()), name);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('открытие файла', () => {
  it('успешная загрузка: схема, название, история очищена, симуляция с состояния включения', () => {
    const t = setup();
    const before = t.circuit().documentVersion;
    const compilations = t.simulation().compilations;

    const result = t.commands.openDocument('latch.lsim', latchText());
    expect(result).toEqual({ status: 'loaded', name: 'RS-защёлка', warnings: [] });
    expect(t.circuit().circuit.components.map((c) => c.id)).toEqual(['S', 'R', 'Q', 'QN']);
    expect(t.circuit().name).toBe('RS-защёлка');
    expect(t.circuit().documentVersion).toBe(before + 1);
    expect(selectCanUndo(t.circuit())).toBe(false);
    expect(t.dirty()).toBe(false);
    expect(t.simulation().compilations).toBe(compilations + 1);
    expect(t.simulation().time).toBe(0);
  });

  it('после загрузки защёлка в состоянии включения, даже если до этого была переключена', () => {
    const t = setup();
    t.commands.openDocument('latch.lsim', latchText());
    const powerUp = t.signal(out('Q'));
    // Переключаем защёлку S=1 → S=0 и сохраняем исходный файл заново.
    const trigger = powerUp === 1 ? 'R' : 'S';
    t.commands.toggleInput(trigger);
    t.commands.toggleInput(trigger);
    expect(t.signal(out('Q'))).not.toBe(powerUp);
    t.circuit().markSaved();

    t.commands.openDocument('latch.lsim', latchText());
    expect(t.signal(out('Q'))).toBe(powerUp);
  });

  it('запущенная симуляция останавливается, время сбрасывается', () => {
    const t = setup();
    t.circuit().addComponent('TEST_CLOCK', { x: 0, y: 0 });
    t.circuit().markSaved();
    t.app.simulationController.start();
    vi.advanceTimersByTime(2000);
    expect(t.simulation().time).toBeGreaterThan(0);

    t.commands.openDocument('latch.lsim', latchText());
    expect(t.simulation().running).toBe(false);
    expect(t.app.simulationController.isTimerActive()).toBe(false);
    expect(t.simulation().time).toBe(0);
  });

  it('выделение, режим размещения и счётчик вставок сбрасываются; буфер обмена сохраняется', () => {
    const t = setup();
    t.commands.openDocument('latch.lsim', latchText());
    t.ui().select({ components: ['Q'] });
    t.commands.copySelection();
    t.ui().startPlacement('AND');
    t.circuit().markSaved();

    // Тот же файл: id совпадают, pruneSelection их бы не убрал.
    t.commands.openDocument('latch.lsim', latchText());
    expect(t.ui().selection).toEqual({ components: [], wires: [] });
    expect(t.ui().placement).toBeNull();
    expect(t.ui().clipboard?.components).toHaveLength(1);
  });

  it('без названия в файле — название по имени файла', () => {
    const t = setup();
    expect(t.commands.openDocument('Мой сумматор.JSON', latchText(''))).toMatchObject({ name: 'Мой сумматор' });
    expect(t.circuit().name).toBe('Мой сумматор');
  });

  it('исправимые ошибки: нормализованная схема с предупреждениями, индикатор горит', () => {
    const t = setup();
    const document = validDocument();
    (document.components as Record<string, unknown>[])[1]!.props = { inputCount: 50 };
    const result = t.commands.openDocument('x.lsim', toText(document));
    expect(result).toEqual({ status: 'loaded', name: 'Тест', warnings: [{ code: 'props-normalized', count: 1 }] });
    expect(t.circuit().circuit.components[1]!.props).toEqual({ inputCount: 8 });
    expect(t.dirty()).toBe(true);
  });

  it.each([
    ['неподдерживаемое расширение', 'x.txt', latchText(), 'unsupported-extension'],
    ['неверный JSON', 'x.lsim', '{', 'invalid-json'],
    ['версия новее', 'x.lsim', latchText().replace('"version": 1', '"version": 99'), 'unsupported-version'],
    ['неизвестный тип', 'x.lsim', latchText().replaceAll('"NOR"', '"UNKNOWN_ELEMENT"'), 'unknown-type'],
    ['повтор id', 'x.lsim', latchText().replace('"id": "R"', '"id": "S"'), 'duplicate-component-id'],
  ])('отклонённый файл (%s) ничего не меняет', (_, fileName, text, code) => {
    const t = setup();
    edited(t);
    const before = snapshot(t);

    const result = t.commands.openDocument(fileName, text);
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.errors[0]!.code).toBe(code);
    const after = snapshot(t);
    expect(after.circuit).toBe(before.circuit);
    expect(after.history).toBe(before.history);
    expect(after.savedCircuit).toBe(before.savedCircuit);
    expect(after.simulation[2]).toBe(before.simulation[2]);
    expect(after).toEqual(before);
  });
});

describe('подтверждение потери несохранённых изменений', () => {
  it('открытие при несохранённых изменениях ждёт подтверждения и не меняет документ', () => {
    const t = setup();
    edited(t);
    const before = snapshot(t);

    expect(t.commands.openDocument('latch.lsim', latchText())).toEqual({ status: 'pending' });
    expect(t.ui().dialog).toBe('discard-changes');
    expect(t.ui().pendingDocument).toMatchObject({ kind: 'open', name: 'RS-защёлка' });
    expect({ ...snapshot(t), dialog: before.dialog }).toEqual(before);

    const applied = t.commands.confirmPendingDocument();
    expect(applied).toMatchObject({ kind: 'open', name: 'RS-защёлка', warnings: [] });
    expect(t.circuit().name).toBe('RS-защёлка');
    expect(t.circuit().circuit.components).toHaveLength(4);
    expect(t.ui().dialog).toBeNull();
    expect(t.ui().pendingDocument).toBeNull();
    expect(t.dirty()).toBe(false);
  });

  it('отмена оставляет документ и закрывает диалог', () => {
    const t = setup();
    edited(t);
    const before = snapshot(t);
    t.commands.openDocument('latch.lsim', latchText());
    t.commands.cancelPendingDocument();
    expect(snapshot(t)).toEqual(before);
    expect(t.ui().pendingDocument).toBeNull();
    expect(t.commands.confirmPendingDocument()).toBeNull();
    expect(t.circuit().name).toBe('Текущая');
  });

  it('закрытие диалога (Esc) тоже отменяет ожидающий документ', () => {
    const t = setup();
    edited(t);
    t.commands.newDocument();
    t.ui().closeDialog();
    expect(t.ui().pendingDocument).toBeNull();
    expect(t.circuit().circuit.components).toHaveLength(2);
  });

  it('отклонённый файл не открывает диалог даже при несохранённых изменениях', () => {
    const t = setup();
    edited(t);
    expect(t.commands.openDocument('x.lsim', '{').status).toBe('rejected');
    expect(t.ui().dialog).toBeNull();
  });

  it('новый документ: без изменений — сразу, с изменениями — после подтверждения', () => {
    const t = setup();
    expect(t.commands.newDocument()).toBe('created');

    edited(t);
    expect(t.commands.newDocument()).toBe('pending');
    expect(t.circuit().circuit.components).toHaveLength(2);
    expect(t.commands.confirmPendingDocument()).toEqual({ kind: 'new' });
    expect(t.circuit().circuit.components).toEqual([]);
    expect(t.circuit().name).toBe('');
    expect(t.ui().selection.components).toEqual([]);
    expect(selectCanUndo(t.circuit())).toBe(false);
    expect(t.dirty()).toBe(false);
  });
});

describe('сохранение', () => {
  it('передаёт файл в download и после этого выключает индикатор', () => {
    const t = setup();
    edited(t);
    const download = vi.fn();

    const result = t.commands.saveDocument(download, FALLBACK);
    expect(result).toEqual({ ok: true, fileName: 'Текущая.lsim' });
    expect(download).toHaveBeenCalledTimes(1);
    const [fileName, text] = download.mock.calls[0]! as [string, string];
    expect(fileName).toBe('Текущая.lsim');
    const parsed = parseCircuitFile(text, t.registry);
    expect(parsed.ok && parsed.circuit).toEqual(t.circuit().circuit);
    expect(parsed.ok && parsed.name).toBe('Текущая');
    expect(t.dirty()).toBe(false);
  });

  it('документ без названия сохраняется под запасным именем', () => {
    const t = setup();
    const download = vi.fn();
    t.commands.saveDocument(download, FALLBACK);
    expect(download.mock.calls[0]![0]).toBe('Без названия.lsim');
  });

  it('ошибка запуска скачивания оставляет индикатор включённым', () => {
    const t = setup();
    edited(t);
    const error = new Error('blocked');
    const result = t.commands.saveDocument(() => {
      throw error;
    }, FALLBACK);
    expect(result).toEqual({ ok: false, error });
    expect(t.dirty()).toBe(true);
    expect(t.circuit().savedCircuit).not.toBe(t.circuit().circuit);
  });

  it('сохранение не меняет схему, историю и симуляцию', () => {
    const t = setup();
    edited(t);
    const before = snapshot(t);
    t.commands.saveDocument(vi.fn(), FALLBACK);
    const after = snapshot(t);
    expect({ ...after, savedCircuit: before.savedCircuit, savedName: before.savedName }).toEqual(before);
    expect(after.history).toBe(before.history);
  });

  it('сохранённый файл открывается и даёт ту же схему', () => {
    const t = setup();
    edited(t);
    let saved = '';
    t.commands.saveDocument((_, text) => (saved = text), FALLBACK);
    const original = t.circuit().circuit;

    t.commands.newDocument();
    expect(t.commands.openDocument('Текущая.lsim', saved)).toMatchObject({ status: 'loaded', name: 'Текущая' });
    expect(t.circuit().circuit).toEqual(original);
  });
});
