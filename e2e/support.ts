import { expect, type Locator, type Page } from '@playwright/test';

/** Узлы на поле по типу элемента. */
export const nodesOfType = (page: Page, type: string) => page.locator(`[data-testid^="node-"][data-type="${type}"]`);

export const wires = (page: Page) => page.locator('[data-testid^="wire-"]');

export async function nodeId(node: Locator): Promise<string> {
  const testId = await node.getAttribute('data-testid');
  if (!testId) throw new Error('У узла нет data-testid');
  return testId.replace(/^node-/, '');
}

export const pin = (page: Page, id: string, pinId: string) => page.getByTestId(`pin-${id}-${pinId}`);

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Элемент не виден');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Перетаскивает элемент из палитры в точку поля (координаты относительно поля). Возвращает id нового узла. */
export async function dropElement(page: Page, type: string, at: { x: number; y: number }): Promise<string> {
  const before = await nodesOfType(page, type).count();
  await page.getByTestId(`palette-${type}`).dragTo(page.locator('[data-canvas]'), { targetPosition: at });
  await expect(nodesOfType(page, type)).toHaveCount(before + 1);
  return nodeId(nodesOfType(page, type).last());
}

/** Протягивает провод мышью между двумя точками-пинами. */
export async function drawWire(page: Page, from: Locator, to: Locator) {
  const a = await center(from);
  const b = await center(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 15 });
  await page.mouse.up();
}

/** Начинает протягивание провода и останавливается над точкой — для проверки подсветки. */
export async function startWire(page: Page, from: Locator, hover: { x: number; y: number }) {
  const a = await center(from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(hover.x, hover.y, { steps: 10 });
}

export async function dragBy(page: Page, locator: Locator, dx: number, dy: number) {
  const a = await center(locator);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + dx, a.y + dy, { steps: 12 });
  await page.mouse.up();
}

export const compilations = async (page: Page) =>
  Number(await page.getByTestId('status-bar').getAttribute('data-compilations'));

export { center };
