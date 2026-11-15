import { expect, test, type Page } from '@playwright/test';
import { circuitFile, compilations, expectPanelClosed, expectPanelOpen, nodesOfType, openCircuit, pin, wires } from './support';

/*
 * MUX и DEMUX: палитра, символ, сигналы, смена разрядности в инспекторе и контекстном меню,
 * Undo, таблица истинности, узкий экран. Схемы загружаются из .lsim.
 */

/** MUX 2:1: A → D0, B → D1, S → S0, Y — индикатор. */
const mux = circuitFile(
  'Мультиплексор',
  [
    ['A', 'INPUT', 0, 0, 'A'],
    ['B', 'INPUT', 0, 80, 'B'],
    ['S', 'INPUT', 0, 200, 'S'],
    ['M', 'MUX', 200, 20],
    ['Y', 'OUTPUT', 400, 30, 'Y'],
  ],
  [
    ['A', 'M.d0'],
    ['B', 'M.d1'],
    ['S', 'M.s0'],
    ['M.y', 'Y'],
  ],
);

/** DEMUX 1:2: D → D, S → S0, выходы на индикаторы Y0, Y1. */
const demux = circuitFile(
  'Демультиплексор',
  [
    ['D', 'INPUT', 0, 0, 'D', { value: true }],
    ['S', 'INPUT', 0, 160, 'S'],
    ['X', 'DEMUX', 200, 0],
    ['Y0', 'OUTPUT', 400, 0, 'Y0'],
    ['Y1', 'OUTPUT', 400, 80, 'Y1'],
  ],
  [
    ['D', 'X.d'],
    ['S', 'X.s0'],
    ['X.y0', 'Y0'],
    ['X.y1', 'Y1'],
  ],
);

const signal = (page: Page, id: string, pinId: string) => pin(page, id, pinId).getAttribute('data-signal');
const inspector = (page: Page) => page.getByTestId('inspector');
const inputPins = (page: Page, id: string) => page.getByTestId(`node-${id}`).locator('[data-testid*="-d"], [data-testid*="-s"]');

test.describe('MUX и DEMUX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('palette')).toBeVisible();
  });

  test('палитра: группа «Комбинационные схемы»; MUX по клику — трапеция 2:1 с пинами D0, D1, S0, Y', async ({ page }) => {
    const palette = page.getByTestId('palette');
    await expect(palette.getByRole('heading', { name: 'Комбинационные схемы' })).toBeVisible();
    await expect(page.getByTestId('palette-MUX').locator('svg path')).toBeVisible();
    await expect(page.getByTestId('palette-DEMUX').locator('svg path')).toBeVisible();

    await page.getByTestId('palette-MUX').click();
    const node = nodesOfType(page, 'MUX');
    await expect(node).toHaveCount(1);
    await expect(node).toHaveAttribute('aria-label', 'MUX 2:1');
    await expect(node.getByTestId('mux-ratio')).toHaveText('2:1');
    const id = (await node.getAttribute('data-testid'))!.replace('node-', '');
    for (const pinId of ['d0', 'd1', 's0', 'y']) await expect(pin(page, id, pinId)).toBeAttached();
    await expect(pin(page, id, 'd2')).toHaveCount(0);

    await page.getByTestId('palette-DEMUX').click();
    await expect(nodesOfType(page, 'DEMUX')).toHaveAttribute('aria-label', 'DEMUX 1:2');
  });

  test('MUX: выход следует за выбранным входом; переключение S не перекомпилирует схему', async ({ page }) => {
    await openCircuit(page, mux);
    await expect(page.getByTestId('node-M')).toBeVisible();
    const before = await compilations(page);

    await page.getByTestId('input-toggle-B').click();
    await expect.poll(() => signal(page, 'M', 'y')).toBe('0');
    await page.getByTestId('input-toggle-S').click();
    await expect.poll(() => signal(page, 'M', 'y')).toBe('1');
    await expect(page.getByTestId('node-Y')).toHaveAttribute('data-value', '1');
    await page.getByTestId('input-toggle-A').click();
    await page.getByTestId('input-toggle-B').click();
    await expect.poll(() => signal(page, 'M', 'y')).toBe('0');
    await page.getByTestId('input-toggle-S').click();
    await expect.poll(() => signal(page, 'M', 'y')).toBe('1');
    expect(await compilations(page)).toBe(before);
  });

  test('DEMUX: D на выбранный выход, второй выход 0', async ({ page }) => {
    await openCircuit(page, demux);
    await expect(page.getByTestId('node-X')).toBeVisible();
    await expect.poll(() => Promise.all([signal(page, 'X', 'y0'), signal(page, 'X', 'y1')])).toEqual(['1', '0']);
    await page.getByTestId('input-toggle-S').click();
    await expect.poll(() => Promise.all([signal(page, 'X', 'y0'), signal(page, 'X', 'y1')])).toEqual(['0', '1']);
    await expect(page.getByTestId('node-Y1')).toHaveAttribute('data-value', '1');
    await page.getByTestId('input-toggle-D').click();
    await expect.poll(() => Promise.all([signal(page, 'X', 'y0'), signal(page, 'X', 'y1')])).toEqual(['0', '0']);
  });

  test('инспектор: «Входы выбора» меняет разрядность, провода сохраняются, Undo возвращает 2:1', async ({ page }) => {
    await openCircuit(page, mux);
    await page.getByTestId('node-M').click();
    await expect(inspector(page).getByTestId('inspector-title')).toHaveText('MUX');
    await expect(inspector(page).getByText('Входы выбора')).toBeVisible();
    await expect(inspector(page).getByTestId('prop-selectBits')).toHaveText('1');
    const before = await compilations(page);

    await inspector(page).getByRole('button', { name: 'Входы выбора: +1' }).click();
    await expect(inspector(page).getByTestId('prop-selectBits')).toHaveText('2');
    await expect(page.getByTestId('node-M')).toHaveAttribute('aria-label', 'MUX 4:1');
    for (const pinId of ['d2', 'd3', 's1']) await expect(pin(page, 'M', pinId)).toBeAttached();
    await expect(inspector(page).getByTestId('inspector-pin-s1')).toContainText('не подключён');
    await expect(wires(page)).toHaveCount(4);
    expect(await compilations(page)).toBe(before + 1);

    await inspector(page).getByRole('button', { name: 'Входы выбора: +1' }).click();
    await expect(page.getByTestId('node-M')).toHaveAttribute('aria-label', 'MUX 8:1');
    await expect(inspector(page).getByRole('button', { name: 'Входы выбора: +1' })).toBeDisabled();
    await expect(inputPins(page, 'M')).toHaveCount(11);

    await page.getByTestId('undo').click();
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('node-M')).toHaveAttribute('aria-label', 'MUX 2:1');
    await expect(pin(page, 'M', 'd2')).toHaveCount(0);
    await expect(wires(page)).toHaveCount(4);
  });

  test('контекстное меню: уменьшение разрядности DEMUX удаляет провода исчезнувших выходов', async ({ page }) => {
    const document = circuitFile(
      'DEMUX 1:4',
      [
        ['D', 'INPUT', 0, 0, 'D'],
        ['X', 'DEMUX', 200, 0, undefined, { selectBits: 2 }],
        ['Y3', 'OUTPUT', 400, 60, 'Y3'],
        ['Y0', 'OUTPUT', 400, 0, 'Y0'],
      ],
      [
        ['D', 'X.d'],
        ['X.y3', 'Y3'],
        ['X.y0', 'Y0'],
      ],
    );
    await openCircuit(page, document);
    await expect(page.getByTestId('node-X')).toHaveAttribute('aria-label', 'DEMUX 1:4');
    await expect(wires(page)).toHaveCount(3);

    await page.getByTestId('node-X').click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await expect(menu.getByTestId('prop-selectBits')).toHaveText('2');
    await menu.getByRole('button', { name: 'Входы выбора: −1' }).click();
    await expect(menu.getByTestId('prop-selectBits')).toHaveText('1');
    await expect(page.getByTestId('node-X')).toHaveAttribute('aria-label', 'DEMUX 1:2');
    await expect(pin(page, 'X', 'y3')).toHaveCount(0);
    await expect(wires(page)).toHaveCount(2);
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+z');
    await expect(pin(page, 'X', 'y3')).toBeAttached();
    await expect(wires(page)).toHaveCount(3);
  });

  test('таблица истинности MUX 2:1: 8 строк, Y = D[S]', async ({ page }) => {
    await openCircuit(page, mux);
    await page.getByTestId('open-truth-table').click();
    await expect(page.getByTestId('truth-table-input')).toHaveText(['A', 'B', 'S']);
    await expect(page.getByTestId('truth-table-output')).toHaveText(['Y']);
    const rows = await page
      .getByTestId('truth-table-row')
      .evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent).join('')));
    expect(rows).toEqual(['0000', '0010', '0100', '0111', '1001', '1010', '1101', '1111']);
    await expect(page.getByTestId('truth-table-note')).toHaveCount(0);
  });
});

test.describe('MUX на узком экране', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  test('размещение тапом, смена разрядности в инспекторе, без переполнения страницы', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('toggle-palette').tap();
    await expectPanelOpen(page.getByTestId('palette'));
    await page.getByTestId('palette-MUX').scrollIntoViewIfNeeded();
    await page.getByTestId('palette-MUX').tap();
    await expect(page.getByTestId('placement-hint')).toContainText('MUX');
    await expectPanelClosed(page.getByTestId('palette'));

    const canvas = (await page.locator('[data-canvas]').boundingBox())!;
    await page.touchscreen.tap(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    const node = nodesOfType(page, 'MUX');
    await expect(node).toHaveCount(1);
    await expect(node).toBeInViewport();

    await page.getByTestId('toggle-inspector').tap();
    await expectPanelOpen(inspector(page));
    await expect(inspector(page).getByTestId('inspector-title')).toHaveText('MUX');
    await inspector(page).getByRole('button', { name: 'Входы выбора: +1' }).tap();
    await expect(node).toHaveAttribute('aria-label', 'MUX 4:1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
