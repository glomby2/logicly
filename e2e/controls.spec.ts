import { expect, test, type Page } from '@playwright/test';
import { center, compilations, drawWire, dropElement, nodesOfType, pin } from './support';

test.describe('мышь и клавиатура', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('palette')).toBeVisible();
  });

  test('панель симуляции: без элементов времени Start и Step скрыты, Reset сбрасывает защёлку', async ({ page }) => {
    await expect(page.getByTestId('sim-reset')).toBeVisible();
    await expect(page.getByTestId('sim-start')).toHaveCount(0);
    await expect(page.getByTestId('sim-step')).toHaveCount(0);
    await expect(page.getByTestId('sim-frequency')).toHaveCount(0);

    // RS-защёлка на NOR: Q = NOR(R, Q̄), Q̄ = NOR(S, Q).
    const s = await dropElement(page, 'INPUT', { x: 120, y: 150 });
    const r = await dropElement(page, 'INPUT', { x: 120, y: 330 });
    const q = await dropElement(page, 'NOR', { x: 380, y: 170 });
    const qn = await dropElement(page, 'NOR', { x: 380, y: 310 });
    await drawWire(page, pin(page, r, 'out0'), pin(page, q, 'in0'));
    await drawWire(page, pin(page, qn, 'out0'), pin(page, q, 'in1'));
    await drawWire(page, pin(page, s, 'out0'), pin(page, qn, 'in0'));
    await drawWire(page, pin(page, q, 'out0'), pin(page, qn, 'in1'));

    const qNode = page.getByTestId(`node-${q}`);
    const powerUp = await qNode.getAttribute('data-output');
    const trigger = powerUp === '1' ? r : s;
    await page.getByTestId(`input-toggle-${trigger}`).click();
    await page.getByTestId(`input-toggle-${trigger}`).click();
    await expect(qNode).not.toHaveAttribute('data-output', powerUp!);

    await page.getByTestId('sim-reset').click();
    await expect(qNode).toHaveAttribute('data-output', powerUp!);
  });

  test('стрелки двигают выделенное без перекомпиляции; undo отменяет один шаг', async ({ page }) => {
    const g = await dropElement(page, 'AND', { x: 300, y: 200 });
    const node = page.getByTestId(`node-${g}`);
    await node.click();
    const start = (await node.boundingBox())!;
    const before = await compilations(page);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => (await node.boundingBox())!.x - start.x).toBeCloseTo(30, 0);
    expect((await node.boundingBox())!.y - start.y).toBeCloseTo(50, 0);
    expect(await compilations(page)).toBe(before);

    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await node.boundingBox())!.y - start.y).toBeCloseTo(0, 0);
    expect((await node.boundingBox())!.x - start.x).toBeCloseTo(30, 0);
  });

  test('стрелки в поле подписи не двигают элемент', async ({ page }) => {
    const g = await dropElement(page, 'AND', { x: 300, y: 200 });
    const node = page.getByTestId(`node-${g}`);
    await node.click();
    const start = (await node.boundingBox())!;
    const field = page.getByTestId('inspector-label');
    await field.fill('AB');
    await field.press('ArrowLeft');
    await field.press('Delete');
    await field.press('Enter');
    await expect(node).toContainText('A');
    expect((await node.boundingBox())!.x).toBeCloseTo(start.x, 0);
  });

  test('справка: F1, кнопка «?», Esc и клик по фону; пока открыта, Delete не удаляет', async ({ page }) => {
    const g = await dropElement(page, 'AND', { x: 300, y: 200 });
    await page.getByTestId(`node-${g}`).click();

    await page.keyboard.press('F1');
    const dialog = page.getByTestId('shortcuts-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Ctrl+Z');
    await page.keyboard.press('Delete');
    await expect(nodesOfType(page, 'AND')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // Esc закрыл только диалог — выделение сохранилось.
    await expect(page.locator(`.react-flow__node[data-id="${g}"]`)).toHaveClass(/selected/);

    await page.getByTestId('open-help').click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(10, 300);
    await expect(dialog).toBeHidden();
  });

  test('клик мышью по палитре добавляет элемент сразу, без режима размещения', async ({ page }) => {
    await page.getByTestId('palette-AND').click();
    await expect(nodesOfType(page, 'AND')).toHaveCount(1);
    await expect(page.getByTestId('placement-hint')).toHaveCount(0);
  });
});

test.describe('сенсорный экран', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  async function openPalette(page: Page) {
    await page.getByTestId('toggle-palette').tap();
    await expect(page.getByTestId('palette')).toBeInViewport();
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('тулбар помещается в экран: второстепенные кнопки скрыты, удаление доступно', async ({ page }) => {
    const header = page.locator('header');
    const overflow = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole('button', { name: /^Копировать/ })).toBeHidden();
    await expect(page.getByRole('button', { name: /^Вставить/ })).toBeHidden();
    await expect(page.getByTestId('open-help')).toBeHidden();
    await expect(page.getByTestId('delete')).toBeVisible();
    await expect(page.getByTestId('sim-reset')).toBeVisible();
  });

  test('тап по палитре, затем тап по полю ставит элемент в точку касания', async ({ page }) => {
    await openPalette(page);
    await page.getByTestId('palette-AND').tap();
    await expect(page.getByTestId('placement-hint')).toContainText('AND');
    await expect(page.getByTestId('palette')).not.toBeInViewport();
    await expect(nodesOfType(page, 'AND')).toHaveCount(0);

    const canvas = (await page.locator('[data-canvas]').boundingBox())!;
    const target = { x: canvas.x + 200, y: canvas.y + 300 };
    await page.touchscreen.tap(target.x, target.y);
    await expect(nodesOfType(page, 'AND')).toHaveCount(1);
    await expect(page.getByTestId('placement-hint')).toHaveCount(0);

    const placed = await center(nodesOfType(page, 'AND'));
    expect(Math.abs(placed.x - target.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(placed.y - target.y)).toBeLessThanOrEqual(10);
  });

  test('повторный тап по тому же элементу палитры и кнопка «Отмена» выключают режим', async ({ page }) => {
    await openPalette(page);
    await page.getByTestId('palette-OR').tap();
    await openPalette(page);
    await page.getByTestId('palette-OR').tap();
    await expect(page.getByTestId('placement-hint')).toHaveCount(0);

    await openPalette(page);
    await page.getByTestId('palette-NOT').tap();
    await page.getByTestId('placement-hint').getByRole('button').tap();
    await expect(page.getByTestId('placement-hint')).toHaveCount(0);
    const canvas = (await page.locator('[data-canvas]').boundingBox())!;
    await page.touchscreen.tap(canvas.x + 150, canvas.y + 150);
    await expect(nodesOfType(page, 'NOT')).toHaveCount(0);
  });

  test('переключение INPUT тапом и удаление из инспектора без клавиатуры', async ({ page }) => {
    await openPalette(page);
    await page.getByTestId('palette-INPUT').tap();
    const canvas = (await page.locator('[data-canvas]').boundingBox())!;
    await page.touchscreen.tap(canvas.x + 150, canvas.y + 200);
    const input = nodesOfType(page, 'INPUT');
    await expect(input).toHaveCount(1);

    const toggle = page.locator('[data-testid^="input-toggle-"]');
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('toggle-inspector').tap();
    await expect(page.getByTestId('inspector')).toBeInViewport();
    await expect(page.getByTestId('inspector-title')).toHaveText('INPUT');
    await page.getByTestId('inspector-delete').tap();
    await expect(input).toHaveCount(0);
  });
});
