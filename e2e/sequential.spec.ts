import { expect, test, type Page } from '@playwright/test';
import { circuitFile, compilations, expectPanelClosed, expectPanelOpen, nodesOfType, openCircuit, pin } from './support';

/*
 * Последовательная логика: CLOCK, триггеры, защёлка. Палитра и символы, Step / Start / Pause /
 * Reset, ручной такт, свойство CLOCK, таблица истинности, узкий экран.
 */

/** 3-разрядный сдвиговый регистр: D → F0 → F1 → F2, такт от CLOCK. */
const shiftRegister = circuitFile(
  'Сдвиговый регистр',
  [
    ['K', 'CLOCK', 0, 0, 'CLK'],
    ['D', 'INPUT', 0, 120, 'D', { value: true }],
    ['F0', 'D_FLIP_FLOP', 160, 60],
    ['F1', 'D_FLIP_FLOP', 300, 60],
    ['F2', 'D_FLIP_FLOP', 440, 60],
  ],
  [
    ['D', 'F0.d'],
    ['F0.q', 'F1.d'],
    ['F1.q', 'F2.d'],
    ['K', 'F0.clk'],
    ['K', 'F1.clk'],
    ['K', 'F2.clk'],
  ],
);

/** Асинхронный 3-разрядный счётчик на T-триггерах (T = 1): F(i) тактируется Q̄(i−1). */
const counter = circuitFile(
  'Счётчик',
  [
    ['K', 'CLOCK', 0, 0, 'CLK'],
    ['ONE', 'INPUT', 0, 120, '1', { value: true }],
    ['F0', 'T_FLIP_FLOP', 160, 0],
    ['F1', 'T_FLIP_FLOP', 300, 0],
    ['F2', 'T_FLIP_FLOP', 440, 0],
  ],
  [
    ['ONE', 'F0.t'],
    ['ONE', 'F1.t'],
    ['ONE', 'F2.t'],
    ['K', 'F0.clk'],
    ['F0.qn', 'F1.clk'],
    ['F1.qn', 'F2.clk'],
  ],
);

const q = (page: Page, id: string) => pin(page, id, 'q').getAttribute('data-signal');
const bits = (page: Page, ids: readonly string[]) => Promise.all(ids.map((id) => q(page, id))).then((v) => v.join(''));
const counterValue = async (page: Page) =>
  [1, 2, 4].reduce(async (sum, weight, i) => (await sum) + ((await q(page, `F${i}`)) === '1' ? weight : 0), Promise.resolve(0));
const time = async (page: Page) => Number((await page.getByTestId('sim-time').textContent())!.match(/\d+/)![0]);

test.describe('последовательная логика', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('palette')).toBeVisible();
  });

  test('палитра: CLOCK во «Вводе и выводе», группа «Триггеры и память»; D FLIP-FLOP со значком ▷', async ({ page }) => {
    const palette = page.getByTestId('palette');
    await expect(palette.getByRole('heading', { name: 'Триггеры и память' })).toBeVisible();
    for (const type of ['CLOCK', 'D_LATCH', 'D_FLIP_FLOP', 'T_FLIP_FLOP', 'JK_FLIP_FLOP']) {
      await expect(page.getByTestId(`palette-${type}`).locator('svg')).toBeVisible();
    }
    // Кнопки симуляции появляются вместе с генератором.
    await expect(page.getByTestId('sim-step')).toHaveCount(0);

    await page.getByTestId('palette-D_FLIP_FLOP').click();
    const node = nodesOfType(page, 'D_FLIP_FLOP');
    await expect(node.getByTestId('box-title')).toHaveText('D FLIP-FLOP');
    await expect(node.locator('[data-clock-marker="clk"]')).toHaveCount(1);
    await expect(node).toContainText('Q̄');
    await expect(page.getByTestId('inspector').getByTestId('inspector-pin-clk')).toContainText('CLK');

    await page.getByTestId('palette-CLOCK').click();
    await expect(nodesOfType(page, 'CLOCK')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('sim-step')).toBeVisible();
    await expect(page.getByTestId('sim-start')).toBeVisible();
  });

  test('сдвиговый регистр: каждый передний фронт сдвигает ровно на один разряд', async ({ page }) => {
    await openCircuit(page, shiftRegister);
    await expect(page.getByTestId('node-F2')).toBeVisible();
    expect(await bits(page, ['F0', 'F1', 'F2'])).toBe('000');
    const before = await compilations(page);

    const trace: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('sim-step').click();
      await expect(page.getByTestId('sim-time')).toHaveText(`t = ${i + 1}`);
      trace.push(`${await page.getByTestId('node-K').getAttribute('data-value')}:${await bits(page, ['F0', 'F1', 'F2'])}`);
    }
    // Фронты на нечётных шагах; на задних фронтах (чётных) регистр не меняется.
    expect(trace).toEqual(['1:100', '0:100', '1:110', '0:110', '1:111', '0:111']);
    expect(await compilations(page)).toBe(before);
  });

  test('счётчик: Start / Pause — значение соответствует числу фронтов; Reset — к нулю', async ({ page }) => {
    await openCircuit(page, counter);
    await expect(page.getByTestId('node-F2')).toBeVisible();
    await page.getByTestId('sim-frequency').selectOption('20');
    await page.getByTestId('sim-start').click();
    await expect.poll(() => time(page), { timeout: 5000 }).toBeGreaterThanOrEqual(9);
    await page.getByTestId('sim-pause').click();

    const t = await time(page);
    // Передние фронты генератора — на нечётных шагах: их ⌈t/2⌉.
    expect(await counterValue(page)).toBe(Math.ceil(t / 2) % 8);

    // Повторный Start: счёт продолжается без лишних фронтов — значение по-прежнему равно их числу.
    await page.getByTestId('sim-start').click();
    await expect.poll(() => time(page), { timeout: 5000 }).toBeGreaterThanOrEqual(t + 5);
    await page.getByTestId('sim-pause').click();
    const after = await time(page);
    expect(await counterValue(page)).toBe(Math.ceil(after / 2) % 8);

    await page.getByTestId('sim-reset').click();
    await expect(page.getByTestId('sim-time')).toHaveText('t = 0');
    expect(await counterValue(page)).toBe(0);
    await expect(pin(page, 'F0', 'qn')).toHaveAttribute('data-signal', '1');
    await expect(page.getByTestId('node-K')).toHaveAttribute('data-value', '0');
  });

  test('ручной такт от INPUT: D-триггер захватывает D только по переднему фронту', async ({ page }) => {
    const document = circuitFile(
      'Ручной такт',
      [
        ['D', 'INPUT', 0, 0, 'D'],
        ['C', 'INPUT', 0, 100, 'C'],
        ['F', 'D_FLIP_FLOP', 160, 20],
        ['Y', 'OUTPUT', 320, 30, 'Q'],
      ],
      [
        ['D', 'F.d'],
        ['C', 'F.clk'],
        ['F.q', 'Y'],
      ],
    );
    await openCircuit(page, document);
    await expect(page.getByTestId('node-F')).toBeVisible();
    const before = await compilations(page);
    const output = page.getByTestId('node-Y');

    await page.getByTestId('input-toggle-D').click();
    await expect(output).toHaveAttribute('data-value', '0');
    await page.getByTestId('input-toggle-C').click(); // фронт
    await expect(output).toHaveAttribute('data-value', '1');
    await page.getByTestId('input-toggle-D').click();
    await expect(output).toHaveAttribute('data-value', '1');
    await page.getByTestId('input-toggle-C').click(); // спад
    await page.getByTestId('input-toggle-C').click(); // фронт
    await expect(output).toHaveAttribute('data-value', '0');
    expect(await compilations(page)).toBe(before);
  });

  test('CLOCK: «Полупериод (тактов)» в инспекторе меняет период', async ({ page }) => {
    await openCircuit(page, shiftRegister);
    await page.getByTestId('node-K').click();
    const inspector = page.getByTestId('inspector');
    await expect(inspector.getByTestId('inspector-title')).toHaveText('CLOCK');
    await inspector.getByRole('button', { name: 'Полупериод (тактов): +1' }).click();
    await expect(inspector.getByTestId('prop-halfPeriod')).toHaveText('2');

    const levels: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('sim-step').click();
      await expect(page.getByTestId('sim-time')).toHaveText(`t = ${i + 1}`);
      levels.push((await page.getByTestId('node-K').getAttribute('data-value'))!);
    }
    expect(levels).toEqual(['0', '1', '1', '0', '0', '1']);
  });

  test('таблица истинности D LATCH: E = 1 — Q = D, E = 0 — «↺»', async ({ page }) => {
    const document = circuitFile(
      'Защёлка',
      [
        ['D', 'INPUT', 0, 0, 'D'],
        ['E', 'INPUT', 0, 100, 'E'],
        ['L', 'D_LATCH', 160, 20],
        ['Y', 'OUTPUT', 320, 30, 'Q'],
      ],
      [
        ['D', 'L.d'],
        ['E', 'L.e'],
        ['L.q', 'Y'],
      ],
    );
    await openCircuit(page, document);
    await page.getByTestId('open-truth-table').click();
    const rows = await page
      .getByTestId('truth-table-row')
      .evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent).join('')));
    expect(rows).toEqual(['00↺', '010', '10↺', '111']);
    await expect(page.getByTestId('truth-table-note').first()).toContainText('элементы памяти');
  });
});

test.describe('последовательная логика на узком экране', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  test('размещение CLOCK и T FLIP-FLOP тапом, Step, без переполнения страницы', async ({ page }) => {
    await page.goto('/');
    const canvas = async () => (await page.locator('[data-canvas]').boundingBox())!;

    for (const [type, dy] of [
      ['CLOCK', -80],
      ['T_FLIP_FLOP', 80],
    ] as const) {
      await page.getByTestId('toggle-palette').tap();
      await expectPanelOpen(page.getByTestId('palette'));
      await page.getByTestId(`palette-${type}`).scrollIntoViewIfNeeded();
      await page.getByTestId(`palette-${type}`).tap();
      await expectPanelClosed(page.getByTestId('palette'));
      const box = await canvas();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2 + dy);
      await expect(nodesOfType(page, type)).toHaveCount(1);
    }

    await expect(page.getByTestId('sim-step')).toBeVisible();
    await page.getByTestId('sim-step').tap();
    await expect(nodesOfType(page, 'CLOCK')).toHaveAttribute('data-value', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
