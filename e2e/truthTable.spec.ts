import { expect, test, type Page } from '@playwright/test';
import { circuitFile, compilations, expectPanelOpen, openCircuit, type FileComponentSpec } from './support';

/*
 * Таблица истинности: построение на реальном движке, отображение, выбор строки,
 * три точки входа, изоляция от основной симуляции, узкий экран.
 * Схемы загружаются из .lsim, чтобы не собирать их мышью.
 */

const halfAdder = circuitFile(
  'Полусумматор',
  [
    ['A', 'INPUT', 0, 0, 'A'],
    ['B', 'INPUT', 0, 120, 'B'],
    ['X', 'XOR', 200, 0],
    ['G', 'AND', 200, 120],
    ['S', 'OUTPUT', 400, 0, 'S'],
    ['C', 'OUTPUT', 400, 120, 'C'],
  ],
  [
    ['A', 'X.in0'],
    ['B', 'X.in1'],
    ['A', 'G.in0'],
    ['B', 'G.in1'],
    ['X', 'S'],
    ['G', 'C'],
  ],
);

const norLatch = circuitFile(
  'RS-защёлка',
  [
    ['S', 'INPUT', 0, 0, 'S'],
    ['R', 'INPUT', 0, 160, 'R'],
    ['Q', 'NOR', 200, 0],
    ['QN', 'NOR', 200, 160],
    ['OQ', 'OUTPUT', 400, 0, 'Q'],
  ],
  [
    ['R', 'Q.in0'],
    ['QN', 'Q.in1'],
    ['S', 'QN.in0'],
    ['Q', 'QN.in1'],
    ['Q', 'OQ'],
  ],
);

const oscillator = circuitFile('Генератор', [['N', 'NOT', 0, 0], ['Y', 'OUTPUT', 200, 0, 'Y']], [['N', 'N'], ['N', 'Y']]);

const dialog = (page: Page) => page.getByTestId('truth-table-dialog');
const rows = (page: Page) => page.getByTestId('truth-table-row');
const rowTexts = (page: Page) =>
  rows(page).evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent).join('')));

async function openFromToolbar(page: Page) {
  await page.getByTestId('open-truth-table').click();
  await expect(dialog(page)).toBeVisible();
}

test.describe('таблица истинности', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('palette')).toBeVisible();
  });

  test('полусумматор: заголовки, все комбинации, текущая строка, легенда', async ({ page }) => {
    await openCircuit(page, halfAdder);
    await openFromToolbar(page);

    await expect(page.getByTestId('truth-table-summary')).toHaveText('Входов: 2 · выходов: 2 · комбинаций: 4');
    await expect(page.getByTestId('truth-table-input')).toHaveText(['A', 'B']);
    await expect(page.getByTestId('truth-table-output')).toHaveText(['C', 'S']);
    expect(await rowTexts(page)).toEqual(['0000', '0101', '1001', '1110']);
    await expect(rows(page).nth(0)).toHaveAttribute('data-current', 'true');
    await expect(page.locator('[data-current]')).toHaveCount(1);
    await expect(page.getByTestId('truth-table-legend')).toContainText('не логический сигнал');
    await expect(page.getByTestId('truth-table-note')).toHaveCount(0);
  });

  test('выбор строки: входы схемы получают комбинацию, диалог остаётся открытым, история не пополняется', async ({ page }) => {
    await openCircuit(page, halfAdder);
    await expect(page.getByTestId('undo')).toBeDisabled();
    const before = await compilations(page);
    await openFromToolbar(page);

    await rows(page).nth(3).click();
    await expect(rows(page).nth(3)).toHaveAttribute('data-current', 'true');
    await expect(rows(page).nth(0)).not.toHaveAttribute('data-current');
    await expect(dialog(page)).toBeVisible();

    // Клавиатура: Enter на строке тоже применяет комбинацию.
    await rows(page).nth(2).focus();
    await page.keyboard.press('Enter');
    await expect(rows(page).nth(2)).toHaveAttribute('data-current', 'true');

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByTestId('input-toggle-A')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('input-toggle-B')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('node-X')).toHaveAttribute('data-output', '1');
    await expect(page.getByTestId('node-G')).toHaveAttribute('data-output', '0');
    await expect(page.getByTestId('undo')).toBeDisabled();
    await expect(page.getByTestId('unsaved-indicator')).toBeVisible();
    expect(await compilations(page)).toBe(before);
  });

  test('открытие таблицы не меняет основную симуляцию', async ({ page }) => {
    await openCircuit(page, norLatch);
    // Защёлка в состоянии, отличном от состояния после включения: S = 1, затем S = 0.
    await page.getByTestId('input-toggle-S').click();
    await page.getByTestId('input-toggle-S').click();
    await expect(page.getByTestId('node-Q')).toHaveAttribute('data-output', '1');
    const before = await compilations(page);

    await openFromToolbar(page);
    await dialog(page).getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(await compilations(page)).toBe(before);
    await expect(page.getByTestId('node-Q')).toHaveAttribute('data-output', '1');
    await expect(page.getByTestId('input-toggle-S')).toHaveAttribute('aria-pressed', 'false');
  });

  test('повторное открытие после правки схемы: таблица и текущая строка не устаревают', async ({ page }) => {
    await openCircuit(page, halfAdder);
    await openFromToolbar(page);
    await expect(page.getByTestId('truth-table-output')).toHaveCount(2);
    await expect(rows(page).nth(0)).toHaveAttribute('data-current', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);

    // Переключение INPUT на поле и новый OUTPUT из палитры.
    await page.getByTestId('input-toggle-A').click();
    await page.getByTestId('palette-OUTPUT').click();
    await openFromToolbar(page);
    await expect(page.getByTestId('truth-table-output')).toHaveCount(3);
    await expect(rows(page).nth(2)).toHaveAttribute('data-current', 'true');
    await expect(page.locator('[data-current]')).toHaveCount(1);
  });

  test('защёлка: ↺ в строке хранения с подсказкой и пояснением', async ({ page }) => {
    await openCircuit(page, norLatch);
    await openFromToolbar(page);
    await expect(page.getByTestId('truth-table-input')).toHaveText(['R', 'S']);
    expect(await rowTexts(page)).toEqual(['00↺', '011', '100', '110']);
    const memory = rows(page).nth(0).locator('[data-tone="memory"]');
    await expect(memory).toHaveAttribute('title', /предыдущего состояния.*После сброса: [01]/);
    await expect(page.getByTestId('truth-table-note').first()).toContainText('элементы памяти');
  });

  test('нестабильная схема: X и пометка строки', async ({ page }) => {
    await openCircuit(page, oscillator);
    await openFromToolbar(page);
    expect(await rowTexts(page)).toEqual(['X']);
    await expect(rows(page).first()).toHaveAttribute('data-unstable', 'true');
    await expect(page.getByTestId('truth-table-note')).toContainText(['Неопределённые значения X']);
  });

  test('повторяющиеся подписи различаются номером', async ({ page }) => {
    const document = circuitFile(
      'Повторы',
      [
        ['a', 'INPUT', 0, 0, 'X1'],
        ['b', 'INPUT', 0, 100, 'X1'],
        ['g', 'OR', 200, 0],
        ['y', 'OUTPUT', 400, 0, 'Y1'],
      ],
      [
        ['a', 'g.in0'],
        ['b', 'g.in1'],
        ['g', 'y'],
      ],
    );
    await openCircuit(page, document);
    await openFromToolbar(page);
    await expect(page.getByTestId('truth-table-input')).toHaveText(['X1 (1)', 'X1 (2)']);
    await expect(page.getByTestId('truth-table-note')).toContainText(['Повторяющиеся подписи: X1']);
  });

  test('сообщения: нет выходов, слишком много входов', async ({ page }) => {
    await openCircuit(page, circuitFile('Без выходов', [['a', 'INPUT', 0, 0, 'A']], []));
    await openFromToolbar(page);
    await expect(page.getByTestId('truth-table-message')).toContainText('нет выходов');
    await page.keyboard.press('Escape');

    const inputs: FileComponentSpec[] = Array.from({ length: 11 }, (_, i) => [`i${i}`, 'INPUT', 0, i * 60, `X${i + 1}`]);
    await openCircuit(page, circuitFile('Много входов', [...inputs, ['y', 'OUTPUT', 300, 0, 'Y']], []));
    await openFromToolbar(page);
    await expect(page.getByTestId('truth-table-message')).toContainText('Слишком много входов: 11');
    await expect(page.getByTestId('truth-table')).toHaveCount(0);
  });

  test('пустая схема: кнопка и пункт меню недоступны', async ({ page }) => {
    await expect(page.getByTestId('open-truth-table')).toBeDisabled();
    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 400, y: 300 } });
    await expect(page.getByRole('menuitem', { name: 'Таблица истинности' })).toBeDisabled();
  });

  test('открытие из контекстного меню поля и из инспектора', async ({ page }) => {
    await openCircuit(page, halfAdder);
    await expect(page.getByTestId('node-C')).toBeVisible();
    // Правый верхний угол поля свободен от узлов и до, и после вписывания схемы в экран.
    const pane = page.locator('.react-flow__pane');
    const corner = { x: (await pane.boundingBox())!.width - 40, y: 40 };
    await pane.click({ button: 'right', position: corner });
    await page.getByRole('menuitem', { name: 'Таблица истинности' }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(4);
    await page.keyboard.press('Escape');

    await pane.click({ position: corner });
    await page.getByTestId('inspector-truth-table').click();
    await expect(dialog(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(4);
  });
});

test.describe('таблица истинности на узком экране', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  test('открытие из инспектора, прокрутка внутри диалога, без переполнения страницы', async ({ page }) => {
    await page.goto('/');
    // Широкая таблица: 6 входов и 3 выхода, 64 строки.
    const inputs: FileComponentSpec[] = Array.from({ length: 6 }, (_, i) => [`i${i}`, 'INPUT', 0, i * 80, `Вход${i + 1}`]);
    const outputs: FileComponentSpec[] = Array.from({ length: 3 }, (_, i) => [`o${i}`, 'OUTPUT', 300, i * 80, `Выход${i + 1}`]);
    const wires: [string, string][] = outputs.map(([id], i) => [`i${i}`, id]);
    await openCircuit(page, circuitFile('Широкая', [...inputs, ...outputs], wires), () => page.getByTestId('file-open').tap());
    await expect(page.locator('[data-testid^="node-"][data-type="INPUT"]')).toHaveCount(6);

    await expect(page.getByTestId('open-truth-table')).toBeHidden();
    await page.getByTestId('toggle-inspector').tap();
    await expectPanelOpen(page.getByTestId('inspector'));
    await page.getByTestId('inspector-truth-table').tap();
    await expect(dialog(page)).toBeVisible();

    const box = (await dialog(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await expect(dialog(page).getByRole('button', { name: 'Закрыть', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    const scroll = page.getByTestId('truth-table-scroll');
    const overflow = await scroll.evaluate((el) => ({ x: el.scrollWidth > el.clientWidth, y: el.scrollHeight > el.clientHeight }));
    expect(overflow).toEqual({ x: true, y: true });

    await rows(page).nth(5).tap();
    await expect(rows(page).nth(5)).toHaveAttribute('data-current', 'true');
    await dialog(page).getByRole('button', { name: 'Закрыть', exact: true }).tap();
    await expect(page.getByTestId('input-toggle-i5')).toHaveAttribute('aria-pressed', 'true');
  });
});
