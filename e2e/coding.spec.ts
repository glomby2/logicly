import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { circuitFile, compilations, expectPanelClosed, expectPanelOpen, nodesOfType, openCircuit, pin, wires } from './support';

/*
 * DECODER, ENCODER, PRIORITY ENCODER: палитра, функциональный блок с конфигурацией, сигналы,
 * смена разрядности в инспекторе и контекстном меню, Undo/Redo, файлы, таблица истинности,
 * длинное название, узкий экран. Схемы загружаются из .lsim.
 */

/** DECODER 2:4: A0, A1 → код, выходы на индикаторы Y0…Y3. */
const decoder = circuitFile(
  'Дешифратор',
  [
    ['A0', 'INPUT', 0, 0, 'A0'],
    ['A1', 'INPUT', 0, 80, 'A1'],
    ['DEC', 'DECODER', 200, 0],
    ['Y0', 'OUTPUT', 400, 0, 'Y0'],
    ['Y1', 'OUTPUT', 400, 60, 'Y1'],
    ['Y2', 'OUTPUT', 400, 120, 'Y2'],
    ['Y3', 'OUTPUT', 400, 180, 'Y3'],
  ],
  [
    ['A0', 'DEC.a0'],
    ['A1', 'DEC.a1'],
    ['DEC.y0', 'Y0'],
    ['DEC.y1', 'Y1'],
    ['DEC.y2', 'Y2'],
    ['DEC.y3', 'Y3'],
  ],
);

/** PRIORITY ENCODER 4:2: D0…D3 → входы, A0, A1, V — индикаторы. */
const priority = circuitFile(
  'Приоритетный шифратор',
  [
    ['D0', 'INPUT', 0, 0, 'D0'],
    ['D1', 'INPUT', 0, 60, 'D1'],
    ['D2', 'INPUT', 0, 120, 'D2'],
    ['D3', 'INPUT', 0, 180, 'D3'],
    ['P', 'PRIORITY_ENCODER', 200, 0],
    ['A0', 'OUTPUT', 440, 0, 'A0'],
    ['A1', 'OUTPUT', 440, 60, 'A1'],
    ['V', 'OUTPUT', 440, 120, 'V'],
  ],
  [
    ['D0', 'P.d0'],
    ['D1', 'P.d1'],
    ['D2', 'P.d2'],
    ['D3', 'P.d3'],
    ['P.a0', 'A0'],
    ['P.a1', 'A1'],
    ['P.v', 'V'],
  ],
);

const signal = (page: Page, id: string, pinId: string) => pin(page, id, pinId).getAttribute('data-signal');
const values = (page: Page, ids: readonly string[]) =>
  Promise.all(ids.map((id) => page.getByTestId(`node-${id}`).getAttribute('data-value')));
const inspector = (page: Page) => page.getByTestId('inspector');
const tableRows = (page: Page) =>
  page
    .getByTestId('truth-table-row')
    .evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent).join('')));

/** Содержимое элемента (текст и дочерние узлы) не выходит за его границы и не прокручивается. */
async function expectContained(locator: Locator) {
  const fits = await locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const content = range.getBoundingClientRect();
    const inside =
      content.left >= box.left - 0.5 &&
      content.right <= box.right + 0.5 &&
      content.top >= box.top - 0.5 &&
      content.bottom <= box.bottom + 0.5;
    return { inside, scroll: el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight };
  });
  expect(fits).toEqual({ inside: true, scroll: true });
}

test.describe('DECODER, ENCODER, PRIORITY ENCODER', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('palette')).toBeVisible();
  });

  test('палитра: «Комбинационные схемы»; по клику — блоки с названием, конфигурацией и пинами по роли', async ({ page }) => {
    const group = page.getByTestId('palette').getByRole('heading', { name: 'Комбинационные схемы' });
    await expect(group).toBeVisible();

    const cases = [
      ['DECODER', 'DECODER', '2:4', ['a0', 'a1', 'y0', 'y1', 'y2', 'y3'], 'y4'],
      ['ENCODER', 'ENCODER', '4:2', ['d0', 'd1', 'd2', 'd3', 'a0', 'a1'], 'd4'],
      ['PRIORITY_ENCODER', 'PRIORITY ENCODER', '4:2', ['d0', 'd1', 'd2', 'd3', 'a0', 'a1', 'v'], 'a2'],
    ] as const;
    for (const [type, title, variant, pins, absent] of cases) {
      await expect(page.getByTestId(`palette-${type}`).locator('svg rect')).toBeVisible();
      await page.getByTestId(`palette-${type}`).click();
      const node = nodesOfType(page, type);
      await expect(node).toHaveCount(1);
      await expect(node).toHaveAttribute('aria-label', `${title} ${variant}`);
      await expect(node.getByTestId('box-title')).toHaveText(title);
      await expect(node.getByTestId('block-variant')).toHaveText(variant);
      const id = (await node.getAttribute('data-testid'))!.replace('node-', '');
      for (const pinId of pins) await expect(pin(page, id, pinId)).toBeAttached();
      await expect(pin(page, id, absent)).toHaveCount(0);
    }
  });

  test('DECODER 2:4: единица идёт по выходу с номером кода; переключение входов не перекомпилирует', async ({ page }) => {
    await openCircuit(page, decoder);
    await expect(page.getByTestId('node-DEC')).toBeVisible();
    const outputs = ['Y0', 'Y1', 'Y2', 'Y3'];
    await expect.poll(() => values(page, outputs)).toEqual(['1', '0', '0', '0']);
    const before = await compilations(page);

    await page.getByTestId('input-toggle-A0').click();
    await expect.poll(() => values(page, outputs)).toEqual(['0', '1', '0', '0']);
    await page.getByTestId('input-toggle-A1').click();
    await expect.poll(() => values(page, outputs)).toEqual(['0', '0', '0', '1']);
    await page.getByTestId('input-toggle-A0').click();
    await expect.poll(() => values(page, outputs)).toEqual(['0', '0', '1', '0']);
    expect(await compilations(page)).toBe(before);
  });

  test('инспектор: «Разрядность кода» 3 → 2 удаляет провода исчезнувших пинов; Undo и Redo', async ({ page }) => {
    const document = circuitFile(
      'DECODER 3:8',
      [
        ['A0', 'INPUT', 0, 0, 'A0'],
        ['A2', 'INPUT', 0, 120, 'A2'],
        ['DEC', 'DECODER', 200, 0, undefined, { codeBits: 3 }],
        ['Y0', 'OUTPUT', 400, 0, 'Y0'],
        ['Y7', 'OUTPUT', 400, 160, 'Y7'],
      ],
      [
        ['A0', 'DEC.a0'],
        ['A2', 'DEC.a2'],
        ['DEC.y0', 'Y0'],
        ['DEC.y7', 'Y7'],
      ],
    );
    await openCircuit(page, document);
    const node = page.getByTestId('node-DEC');
    await expect(node).toHaveAttribute('aria-label', 'DECODER 3:8');
    await expect(wires(page)).toHaveCount(4);

    await node.click();
    await expect(inspector(page).getByTestId('inspector-title')).toHaveText('DECODER');
    await expect(inspector(page).getByTestId('prop-codeBits')).toHaveText('3');
    await expect(inspector(page).getByRole('button', { name: 'Разрядность кода: +1' })).toBeDisabled();
    const before = await compilations(page);

    await inspector(page).getByRole('button', { name: 'Разрядность кода: −1' }).click();
    await expect(node).toHaveAttribute('aria-label', 'DECODER 2:4');
    await expect(node.getByTestId('block-variant')).toHaveText('2:4');
    await expect(inspector(page).getByRole('button', { name: 'Разрядность кода: −1' })).toBeDisabled();
    for (const pinId of ['a2', 'y4', 'y7']) await expect(pin(page, 'DEC', pinId)).toHaveCount(0);
    // Остались провода A0 → a0 и y0 → Y0.
    await expect(wires(page)).toHaveCount(2);
    expect(await compilations(page)).toBe(before + 1);

    await page.keyboard.press('Control+z');
    await expect(node).toHaveAttribute('aria-label', 'DECODER 3:8');
    await expect(pin(page, 'DEC', 'y7')).toBeAttached();
    await expect(wires(page)).toHaveCount(4);

    await page.getByTestId('redo').click();
    await expect(node).toHaveAttribute('aria-label', 'DECODER 2:4');
    await expect(wires(page)).toHaveCount(2);
  });

  test('контекстное меню: уменьшение разрядности ENCODER удаляет провода на D4…D7, D0…D3 сохраняются', async ({ page }) => {
    const document = circuitFile(
      'ENCODER 8:3',
      [
        ['D1', 'INPUT', 0, 0, 'D1'],
        ['D6', 'INPUT', 0, 120, 'D6'],
        ['E', 'ENCODER', 200, 0, undefined, { codeBits: 3 }],
        ['A2', 'OUTPUT', 400, 120, 'A2'],
      ],
      [
        ['D1', 'E.d1'],
        ['D6', 'E.d6'],
        ['E.a2', 'A2'],
      ],
    );
    await openCircuit(page, document);
    await expect(page.getByTestId('node-E')).toHaveAttribute('aria-label', 'ENCODER 8:3');
    await page.getByTestId('input-toggle-D6').click();
    await expect(page.getByTestId('node-A2')).toHaveAttribute('data-value', '1');

    await page.getByTestId('node-E').click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await expect(menu.getByTestId('prop-codeBits')).toHaveText('3');
    await menu.getByRole('button', { name: 'Разрядность кода: −1' }).click();
    await expect(page.getByTestId('node-E')).toHaveAttribute('aria-label', 'ENCODER 4:2');
    await expect(pin(page, 'E', 'd6')).toHaveCount(0);
    await expect(pin(page, 'E', 'a2')).toHaveCount(0);
    await expect(wires(page)).toHaveCount(1);
    await expect.poll(() => signal(page, 'E', 'd1')).toBe('0');
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('node-E')).toHaveAttribute('aria-label', 'ENCODER 8:3');
    await expect(wires(page)).toHaveCount(3);
  });

  test('PRIORITY ENCODER: при нескольких активных входах — номер старшего; V показывает активный вход', async ({ page }) => {
    await openCircuit(page, priority);
    await expect(page.getByTestId('node-P')).toBeVisible();
    const outputs = ['A0', 'A1', 'V'];
    await expect.poll(() => values(page, outputs)).toEqual(['0', '0', '0']);

    await page.getByTestId('input-toggle-D0').click();
    await expect.poll(() => values(page, outputs)).toEqual(['0', '0', '1']);
    await page.getByTestId('input-toggle-D1').click();
    await page.getByTestId('input-toggle-D3').click();
    await expect.poll(() => values(page, outputs)).toEqual(['1', '1', '1']);
    await page.getByTestId('input-toggle-D3').click();
    await expect.poll(() => values(page, outputs)).toEqual(['1', '0', '1']);
    await page.getByTestId('input-toggle-D1').click();
    await page.getByTestId('input-toggle-D0').click();
    await expect.poll(() => values(page, outputs)).toEqual(['0', '0', '0']);
  });

  test('сохранение и открытие: те же конфигурации и провода', async ({ page }) => {
    const document = circuitFile(
      'Три блока',
      [
        ['DEC', 'DECODER', 0, 0, undefined, { codeBits: 3 }],
        ['ENC', 'ENCODER', 200, 0, undefined, { codeBits: 3 }],
        ['PRI', 'PRIORITY_ENCODER', 400, 0, undefined, { codeBits: 3 }],
      ],
      [
        ['DEC.y7', 'ENC.d7'],
        ['DEC.y5', 'PRI.d5'],
      ],
    );
    await openCircuit(page, document);
    await expect(page.getByTestId('node-PRI')).toHaveAttribute('aria-label', 'PRIORITY ENCODER 8:3');

    const pending = page.waitForEvent('download');
    await page.getByTestId('file-save').click();
    const saved = JSON.parse(await readFile(await (await pending).path(), 'utf8')) as unknown;

    await page.getByTestId('file-new').click();
    await expect(nodesOfType(page, 'DECODER')).toHaveCount(0);
    await openCircuit(page, saved);
    await expect(page.getByTestId('node-DEC')).toHaveAttribute('aria-label', 'DECODER 3:8');
    await expect(page.getByTestId('node-ENC').getByTestId('block-variant')).toHaveText('8:3');
    await expect(page.getByTestId('node-PRI').getByTestId('block-variant')).toHaveText('8:3');
    await expect(wires(page)).toHaveCount(2);
    await expect(page.getByTestId('notification')).toHaveCount(0);
  });

  test('таблица истинности: DECODER 2:4 — 4 строки one-hot; PRIORITY ENCODER 4:2 — 16 строк', async ({ page }) => {
    await openCircuit(page, decoder);
    await page.getByTestId('open-truth-table').click();
    await expect(page.getByTestId('truth-table-input')).toHaveText(['A0', 'A1']);
    await expect(page.getByTestId('truth-table-output')).toHaveText(['Y0', 'Y1', 'Y2', 'Y3']);
    // Первый вход — старший разряд строки; A0 — младший разряд кода.
    expect(await tableRows(page)).toEqual(['001000', '010010', '100100', '110001']);
    await page.keyboard.press('Escape');

    await openCircuit(page, priority);
    await page.getByTestId('open-truth-table').click();
    await expect(page.getByTestId('truth-table-output')).toHaveText(['A0', 'A1', 'V']);
    const rows = await tableRows(page);
    expect(rows).toHaveLength(16);
    expect(rows[0]).toBe('0000000'); // нет активных: A = 00, V = 0
    expect(rows[15]).toBe('1111111'); // D3 активен: A = 11, V = 1
  });

  test('длинное название PRIORITY ENCODER помещается в корпус и в плитку палитры', async ({ page }) => {
    await expectContained(page.getByTestId('palette-PRIORITY_ENCODER'));
    await expectContained(page.getByTestId('palette-DECODER'));

    await page.getByTestId('palette-PRIORITY_ENCODER').click();
    const node = nodesOfType(page, 'PRIORITY_ENCODER');
    await expectContained(node.getByTestId('box-title'));
    const [title, body] = await Promise.all([node.getByTestId('box-title').boundingBox(), node.boundingBox()]);
    expect(title!.x).toBeGreaterThanOrEqual(body!.x);
    expect(title!.x + title!.width).toBeLessThanOrEqual(body!.x + body!.width);
  });
});

test.describe('PRIORITY ENCODER на узком экране', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  test('размещение тапом, смена разрядности в инспекторе, без переполнения страницы и плитки', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('toggle-palette').tap();
    await expectPanelOpen(page.getByTestId('palette'));
    const tile = page.getByTestId('palette-PRIORITY_ENCODER');
    await tile.scrollIntoViewIfNeeded();
    await expectContained(tile);
    await tile.tap();
    await expect(page.getByTestId('placement-hint')).toContainText('PRIORITY ENCODER');
    await expectPanelClosed(page.getByTestId('palette'));

    const canvas = (await page.locator('[data-canvas]').boundingBox())!;
    await page.touchscreen.tap(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    const node = nodesOfType(page, 'PRIORITY_ENCODER');
    await expect(node).toHaveCount(1);
    await expect(node).toBeInViewport();

    await page.getByTestId('toggle-inspector').tap();
    await expectPanelOpen(inspector(page));
    await expect(inspector(page).getByTestId('inspector-title')).toHaveText('PRIORITY ENCODER');
    await inspector(page).getByRole('button', { name: 'Разрядность кода: +1' }).tap();
    await expect(node).toHaveAttribute('aria-label', 'PRIORITY ENCODER 8:3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
