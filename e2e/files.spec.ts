import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { drawWire, dropElement, expectPanelOpen, nodesOfType, pin, wires } from './support';

/*
 * Сохранение и открытие схем: скачивание (событие download), выбор файла (filechooser),
 * ошибки и предупреждения, подтверждение потери несохранённых изменений, узкий экран.
 */

interface FileSpec {
  readonly name: string;
  readonly content: string;
}

const wire = (id: string, from: string, to: string) => ({
  id,
  from: { componentId: from, pinId: 'out0' },
  to: { componentId: to, pinId: 'in0' },
});

/** Инвертор далеко от начала координат: без вписывания в экран его не было бы видно. */
function inverterDocument(overrides: Record<string, unknown> = {}) {
  return {
    format: 'logic-sim',
    version: 1,
    name: 'Инвертор',
    components: [
      { id: 'in-1', type: 'INPUT', position: { x: 3000, y: 2000 }, label: 'X1', props: { value: true } },
      { id: 'not-1', type: 'NOT', position: { x: 3200, y: 2000 }, props: {} },
      { id: 'out-1', type: 'OUTPUT', position: { x: 3400, y: 2000 }, label: 'Y1', props: {} },
    ],
    wires: [wire('w-1', 'in-1', 'not-1'), wire('w-2', 'not-1', 'out-1')],
    ...overrides,
  };
}

const lsim = (document: unknown, name = 'inverter.lsim'): FileSpec => ({ name, content: JSON.stringify(document) });

/** Выбирает файл в системном диалоге, который открывает `trigger`. */
async function chooseFile(page: Page, trigger: () => Promise<void>, file: FileSpec | string) {
  const chooser = page.waitForEvent('filechooser');
  await trigger();
  const files =
    typeof file === 'string' ? file : { name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.content) };
  await (await chooser).setFiles(files);
}

const openViaButton = (page: Page, file: FileSpec | string) =>
  chooseFile(page, () => page.getByTestId('file-open').click(), file);

/** Сохраняет схему и возвращает имя и содержимое скачанного файла. */
async function saveVia(page: Page, trigger: () => Promise<void>) {
  const pending = page.waitForEvent('download');
  await trigger();
  const download = await pending;
  const path = await download.path();
  return { fileName: download.suggestedFilename(), path, text: await readFile(path, 'utf8') };
}

const unsaved = (page: Page) => page.getByTestId('unsaved-indicator');
const notification = (page: Page) => page.getByTestId('notification');

/** Небольшая изменённая схема: INPUT → NOT. */
async function buildInverter(page: Page) {
  const a = await dropElement(page, 'INPUT', { x: 150, y: 200 });
  const n = await dropElement(page, 'NOT', { x: 400, y: 200 });
  await drawWire(page, pin(page, a, 'out0'), pin(page, n, 'in0'));
  await expect(wires(page)).toHaveCount(1);
  return { a, n };
}

test.describe('файлы', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('palette')).toBeVisible();
  });

  test('сохранение кнопкой: файл .lsim с названием, индикатор гаснет', async ({ page }) => {
    await expect(unsaved(page)).toHaveCount(0);
    await buildInverter(page);
    await expect(unsaved(page)).toBeVisible();
    await expect(page).toHaveTitle(/^● Без названия — /);

    await page.getByTestId('document-name').fill('Мой инвертор');
    await page.getByTestId('document-name').press('Enter');
    const file = await saveVia(page, () => page.getByTestId('file-save').click());

    expect(file.fileName).toBe('Мой инвертор.lsim');
    const json = JSON.parse(file.text);
    expect(json).toMatchObject({ format: 'logic-sim', version: 1, name: 'Мой инвертор' });
    expect(json.components.map((c: { type: string }) => c.type)).toEqual(['INPUT', 'NOT']);
    expect(json.wires).toHaveLength(1);
    await expect(unsaved(page)).toHaveCount(0);
    await expect(page).toHaveTitle('Мой инвертор — Логический симулятор');
    await expect(notification(page)).toContainText('Мой инвертор.lsim');
  });

  test('Ctrl+S сохраняет, в том числе из поля названия с неподтверждённым текстом', async ({ page }) => {
    await buildInverter(page);
    await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
    let file = await saveVia(page, () => page.keyboard.press('Control+s'));
    expect(file.fileName).toBe('Без названия.lsim');
    await expect(unsaved(page)).toHaveCount(0);

    await page.getByTestId('document-name').fill('Черновик');
    file = await saveVia(page, () => page.keyboard.press('Control+s'));
    expect(file.fileName).toBe('Черновик.lsim');
    expect(JSON.parse(file.text).name).toBe('Черновик');
    await expect(unsaved(page)).toHaveCount(0);
  });

  test('открытие .lsim: схема, сигналы, название, вписывание в экран, пустая история', async ({ page }) => {
    await openViaButton(page, lsim(inverterDocument()));

    await expect(nodesOfType(page, 'INPUT')).toHaveCount(1);
    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);
    await expect(nodesOfType(page, 'OUTPUT')).toHaveCount(1);
    await expect(wires(page)).toHaveCount(2);
    await expect(page.getByTestId('node-not-1')).toHaveAttribute('data-output', '0');
    await expect(page.getByTestId('document-name')).toHaveValue('Инвертор');
    await expect(page.getByTestId('undo')).toBeDisabled();
    await expect(unsaved(page)).toHaveCount(0);
    await expect(notification(page)).toHaveAttribute('data-tone', 'info');
    for (const id of ['in-1', 'not-1', 'out-1']) await expect(page.getByTestId(`node-${id}`)).toBeInViewport();

    // Схема работает: переключение входа пересчитывает сигналы.
    await page.getByTestId('input-toggle-in-1').click();
    await expect(page.getByTestId('node-not-1')).toHaveAttribute('data-output', '1');
  });

  test('Ctrl+O открывает .json; название по имени файла, если в файле его нет', async ({ page }) => {
    await chooseFile(page, () => page.keyboard.press('Control+o'), lsim(inverterDocument({ name: '' }), 'Схема из JSON.json'));
    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);
    await expect(page.getByTestId('document-name')).toHaveValue('Схема из JSON');
  });

  test('сохранённый файл открывается снова и восстанавливает ту же схему', async ({ page }) => {
    await openViaButton(page, lsim(inverterDocument()));
    await page.getByTestId('input-toggle-in-1').click();
    const saved = await saveVia(page, () => page.getByTestId('file-save').click());

    await page.getByTestId('file-new').click();
    await expect(nodesOfType(page, 'NOT')).toHaveCount(0);
    // download.path() — временный файл без расширения; открываем под именем, под которым он скачан.
    await openViaButton(page, { name: saved.fileName, content: await readFile(saved.path, 'utf8') });

    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);
    await expect(wires(page)).toHaveCount(2);
    await expect(page.getByTestId('input-toggle-in-1')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('node-not-1')).toHaveAttribute('data-output', '1');
  });

  test('отклонённый файл: уведомление об ошибке, схема, название и история не меняются', async ({ page }) => {
    const { n } = await buildInverter(page);
    await page.getByTestId('document-name').fill('Текущая');
    await page.getByTestId('document-name').press('Enter');

    await openViaButton(page, { name: 'broken.lsim', content: '{ "format": "logic-sim", ' });
    await expect(notification(page).last()).toHaveAttribute('data-tone', 'error');
    await expect(notification(page).last()).toContainText('Файл не открыт');
    await expect(page.getByTestId('discard-dialog')).toHaveCount(0);

    await openViaButton(page, lsim(inverterDocument({ version: 7 })));
    await expect(notification(page).last()).toContainText('более новой версией');

    await openViaButton(page, lsim(inverterDocument(), 'notes.txt'));
    await expect(notification(page).last()).toContainText('.lsim и .json');

    await expect(page.getByTestId(`node-${n}`)).toBeVisible();
    await expect(nodesOfType(page, 'INPUT')).toHaveCount(1);
    await expect(page.getByTestId('document-name')).toHaveValue('Текущая');
    await expect(page.getByTestId('undo')).toBeEnabled();
    await expect(unsaved(page)).toBeVisible();
  });

  test('уведомление об ошибке не скрывается само', async ({ page }) => {
    await openViaButton(page, { name: 'broken.lsim', content: 'not json' });
    await expect(notification(page)).toHaveAttribute('data-tone', 'error');
    await page.waitForTimeout(4500);
    await expect(notification(page)).toHaveCount(1);
    await notification(page).getByRole('button').click();
    await expect(notification(page)).toHaveCount(0);
  });

  test('файл с исправимыми ошибками: загружается, предупреждение, индикатор горит', async ({ page }) => {
    const base = inverterDocument();
    const document = inverterDocument({
      components: base.components.map((c) => (c.id === 'not-1' ? { ...c, props: { junk: 1 } } : c)),
      wires: [...base.wires, wire('w-3', 'ghost', 'out-1')],
    });
    await openViaButton(page, lsim(document));

    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);
    await expect(wires(page)).toHaveCount(2);
    await expect(notification(page)).toHaveAttribute('data-tone', 'warning');
    await expect(notification(page)).toContainText('Исправлены свойства элементов: 1');
    await expect(notification(page)).toContainText('Удалены недопустимые провода: 1');
    await expect(unsaved(page)).toBeVisible();
  });

  test('«Новая» при несохранённых изменениях: «Отмена» и Esc оставляют схему, «Не сохранять» очищает', async ({ page }) => {
    await buildInverter(page);
    await page.getByTestId('file-new').click();
    await expect(page.getByTestId('discard-dialog')).toBeVisible();
    await page.getByTestId('discard-cancel').click();
    await expect(page.getByTestId('discard-dialog')).toHaveCount(0);
    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);

    await page.getByTestId('file-new').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('discard-dialog')).toHaveCount(0);
    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);

    await page.getByTestId('file-new').click();
    await page.getByTestId('discard-confirm').click();
    await expect(nodesOfType(page, 'NOT')).toHaveCount(0);
    await expect(page.getByTestId('undo')).toBeDisabled();
    await expect(unsaved(page)).toHaveCount(0);
  });

  test('без несохранённых изменений «Новая» не спрашивает подтверждения', async ({ page }) => {
    await buildInverter(page);
    await saveVia(page, () => page.getByTestId('file-save').click());
    await page.getByTestId('file-new').click();
    await expect(page.getByTestId('discard-dialog')).toHaveCount(0);
    await expect(nodesOfType(page, 'NOT')).toHaveCount(0);
  });

  test('открытие при несохранённых изменениях — после подтверждения', async ({ page }) => {
    await buildInverter(page);
    await openViaButton(page, lsim(inverterDocument()));
    await expect(page.getByTestId('discard-dialog')).toBeVisible();
    await expect(nodesOfType(page, 'OUTPUT')).toHaveCount(0);

    await page.getByTestId('discard-confirm').click();
    await expect(nodesOfType(page, 'OUTPUT')).toHaveCount(1);
    await expect(page.getByTestId('document-name')).toHaveValue('Инвертор');
    await expect(page.getByTestId('node-out-1')).toBeInViewport();
  });

  test('Ctrl+S при открытом диалоге ничего не скачивает', async ({ page }) => {
    await buildInverter(page);
    await page.getByTestId('file-new').click();
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(300);
    expect(downloads).toBe(0);
    await expect(page.getByTestId('discard-dialog')).toBeVisible();
  });

  test('закрытие вкладки с несохранёнными изменениями требует подтверждения', async ({ page }) => {
    await buildInverter(page);
    const dialog = page.waitForEvent('dialog');
    void page.close({ runBeforeUnload: true });
    const prompt = await dialog;
    expect(prompt.type()).toBe('beforeunload');
    await prompt.accept();
  });

  test('без несохранённых изменений вкладка закрывается без вопросов', async ({ page }) => {
    await openViaButton(page, lsim(inverterDocument()));
    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);
    let asked = false;
    page.on('dialog', async (d) => {
      asked = true;
      await d.dismiss();
    });
    await page.close({ runBeforeUnload: true });
    expect(asked).toBe(false);
  });
});

test.describe('файлы на узком экране', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('«Открыть» и «Сохранить» в тулбаре, «Новая» и название — в инспекторе, без переполнения', async ({ page }) => {
    const header = page.locator('header');
    expect(await header.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('file-open')).toBeInViewport();
    await expect(page.getByTestId('file-save')).toBeInViewport();
    await expect(page.getByTestId('file-new')).toBeHidden();
    await expect(page.getByTestId('document-name')).toBeHidden();
    await expect(page.getByTestId('toggle-inspector')).toBeInViewport();

    await page.getByTestId('toggle-inspector').tap();
    await expectPanelOpen(page.getByTestId('inspector'));
    await expect(page.getByTestId('inspector-file-new')).toBeInViewport();
    await expect(page.getByTestId('inspector-document-name')).toBeInViewport();
  });

  test('открытие тапом и создание новой схемы из инспектора', async ({ page }) => {
    await chooseFile(page, () => page.getByTestId('file-open').tap(), lsim(inverterDocument()));
    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);
    await expect(page.getByTestId('node-not-1')).toBeInViewport();

    await page.getByTestId('toggle-inspector').tap();
    await expectPanelOpen(page.getByTestId('inspector'));
    await expect(page.getByTestId('inspector-document-name')).toHaveValue('Инвертор');
    await page.getByTestId('inspector-file-new').tap();
    await expect(nodesOfType(page, 'NOT')).toHaveCount(0);
    await expect(page.getByTestId('inspector-document-name')).toHaveValue('');
  });
});
