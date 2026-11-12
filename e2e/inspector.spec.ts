import { expect, test, type Page } from '@playwright/test';
import { center, drawWire, dropElement, nodesOfType, pin, wires } from './support';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('inspector')).toBeVisible();
});

const viewportStyle = (page: Page) => page.locator('.react-flow__viewport').getAttribute('style');
const inspector = (page: Page) => page.getByTestId('inspector');

test('выделение элемента показывает его свойства и не меняет вид поля', async ({ page }) => {
  const g = await dropElement(page, 'AND', { x: 300, y: 200 });
  await page.getByTestId('zoom-in').click();
  await page.waitForTimeout(250);
  const before = await viewportStyle(page);

  await page.getByTestId(`node-${g}`).click();
  await expect(inspector(page).getByTestId('inspector-title')).toHaveText('AND');
  await inspector(page).getByRole('button', { name: /\+1/ }).click();
  await expect(inspector(page).getByTestId('prop-inputCount')).toHaveText('3');
  await expect(pin(page, g, 'in2')).toBeAttached();
  await expect(inspector(page).getByTestId('inspector-pin-in2')).toContainText('не подключён');

  // Скрыть и показать инспектор — масштаб и сдвиг поля сохраняются.
  await page.getByTestId('toggle-inspector').click();
  await page.getByTestId('toggle-inspector').click();
  await page.waitForTimeout(250);
  expect(await viewportStyle(page)).toBe(before);
});

test('подпись: Enter применяет одним шагом истории, Esc отменяет', async ({ page }) => {
  const g = await dropElement(page, 'AND', { x: 300, y: 200 });
  await page.getByTestId(`node-${g}`).click();
  const field = inspector(page).getByTestId('inspector-label');

  await field.fill('Сумма');
  await field.press('Enter');
  await expect(page.getByTestId(`node-${g}`)).toContainText('Сумма');

  await field.fill('Черновик');
  await field.press('Escape');
  await expect(field).toHaveValue('Сумма');
  await expect(page.getByTestId(`node-${g}`)).toContainText('Сумма');

  await page.keyboard.press('Control+z');
  await expect(page.getByTestId(`node-${g}`)).not.toContainText('Сумма');
  await expect(nodesOfType(page, 'AND')).toHaveCount(1);
});

test('переключатель INPUT и сигналы пинов в инспекторе', async ({ page }) => {
  const a = await dropElement(page, 'INPUT', { x: 150, y: 200 });
  const n = await dropElement(page, 'NOT', { x: 400, y: 200 });
  await drawWire(page, pin(page, a, 'out0'), pin(page, n, 'in0'));

  await page.getByTestId(`node-${n}`).click();
  await expect(inspector(page).getByTestId('inspector-pin-out0')).toContainText('1');

  await page.getByTestId(`node-${a}`).click({ position: { x: 55, y: 20 } });
  const toggle = inspector(page).getByTestId('inspector-toggle');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId(`input-toggle-${a}`)).toHaveAttribute('aria-pressed', 'true');
  await expect(pin(page, n, 'out0')).toHaveAttribute('data-signal', '0');
});

test('инспектор провода: откуда, куда, сигнал и удаление', async ({ page }) => {
  const a = await dropElement(page, 'INPUT', { x: 150, y: 200 });
  const l = await dropElement(page, 'OUTPUT', { x: 450, y: 200 });
  await drawWire(page, pin(page, a, 'out0'), pin(page, l, 'in0'));
  const from = await center(pin(page, a, 'out0'));
  const to = await center(pin(page, l, 'in0'));
  await page.mouse.click((from.x + to.x) / 2, from.y);

  await expect(inspector(page).getByTestId('inspector-title')).toHaveText('Провод');
  await expect(inspector(page).getByTestId('inspector-wire-from')).toHaveText('X1 · Выход 1');
  await expect(inspector(page).getByTestId('inspector-wire-to')).toHaveText('Y1 · Вход 1');
  await expect(inspector(page).getByTestId('inspector-wire-signal')).toHaveAttribute('data-signal', '0');
  await page.getByTestId(`input-toggle-${a}`).click();
  await page.mouse.click((from.x + to.x) / 2, from.y);
  await expect(inspector(page).getByTestId('inspector-wire-signal')).toHaveAttribute('data-signal', '1');

  await inspector(page).getByTestId('inspector-delete').click();
  await expect(wires(page)).toHaveCount(0);
});

test('кнопки действий целиком помещаются в панель инспектора', async ({ page }) => {
  const g = await dropElement(page, 'AND', { x: 300, y: 200 });
  await page.getByTestId(`node-${g}`).click();
  const panel = (await inspector(page).boundingBox())!;
  for (const name of ['Копировать', 'Дублировать', 'Удалить']) {
    const button = (await inspector(page).getByRole('button', { name, exact: true }).boundingBox())!;
    expect(button.x).toBeGreaterThanOrEqual(panel.x);
    expect(button.x + button.width).toBeLessThanOrEqual(panel.x + panel.width);
  }
});

test('несколько элементов: количество и удаление', async ({ page }) => {
  const a = await dropElement(page, 'AND', { x: 150, y: 150 });
  const b = await dropElement(page, 'OR', { x: 400, y: 150 });
  await page.getByTestId(`node-${a}`).click();
  await page.getByTestId(`node-${b}`).click({ modifiers: ['Shift'] });
  await expect(inspector(page).getByTestId('inspector-title')).toHaveText('Выделено: 2');
  await inspector(page).getByTestId('inspector-delete').click();
  await expect(nodesOfType(page, 'AND')).toHaveCount(0);
  await expect(nodesOfType(page, 'OR')).toHaveCount(0);
});

test('сводка схемы: проблемы и переход к элементу без смены масштаба', async ({ page }) => {
  await dropElement(page, 'AND', { x: 200, y: 150 });
  const n = await dropElement(page, 'NOT', { x: 500, y: 400 });
  await page.getByTestId('zoom-out').click();
  await page.waitForTimeout(250);
  const scale = async () => (await viewportStyle(page))!.match(/scale\(([\d.]+)\)/)![1];
  const scaleBefore = await scale();

  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
  await expect(inspector(page).getByTestId('inspector-title')).toHaveText('Схема');
  const issues = inspector(page).getByTestId('inspector-issue');
  await expect(issues).toHaveCount(3);
  await expect(issues.last()).toContainText('NOT · Вход 1');

  await issues.last().click();
  await expect(inspector(page).getByTestId('inspector-title')).toHaveText('NOT');
  await expect(page.locator(`.react-flow__node[data-id="${n}"]`)).toHaveClass(/selected/);
  await page.waitForTimeout(300);
  expect(await scale()).toBe(scaleBefore);
  await expect(page.getByTestId(`node-${n}`)).toBeInViewport();
});
