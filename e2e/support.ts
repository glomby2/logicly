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

/**
 * Ждёт, пока выдвижная панель (палитра, инспектор) полностью откроется: она целиком в окне
 * и CSS-переход завершён. `toBeInViewport` срабатывает уже при частичной видимости,
 * и тап может прийтись на кнопку, которая ещё движется.
 */
export async function expectPanelOpen(panel: Locator) {
  await expect(panel).toBeInViewport();
  await expect
    .poll(() =>
      panel.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.left >= -0.5 && rect.right <= window.innerWidth + 0.5 && el.getAnimations().length === 0;
      }),
    )
    .toBe(true);
}

/**
 * Ждёт, пока выдвижная панель полностью закроется: она целиком за краем окна и переход
 * завершён. Тап по полю, пока панель уезжает, попадёт в неё, а не в поле.
 */
export async function expectPanelClosed(panel: Locator) {
  await expect
    .poll(() =>
      panel.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const outside = rect.right <= 0.5 || rect.left >= window.innerWidth - 0.5 || rect.width === 0;
        return outside && el.getAnimations().length === 0;
      }),
    )
    .toBe(true);
}

/** Описание элемента для файла схемы в сценариях: `['A', 'INPUT', x, y, 'подпись', props?]`. */
export type FileComponentSpec = readonly [
  id: string,
  type: string,
  x: number,
  y: number,
  label?: string,
  props?: Record<string, number | boolean>,
];

const GATES = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'];
const defaultProps = (type: string): Record<string, number | boolean> =>
  type === 'INPUT' ? { value: false } : GATES.includes(type) ? { inputCount: 2 } : {};

/** Документ `.lsim`: элементы и провода `'A' → 'G.in1'` (выход по умолчанию `out0`, вход — `in0`). */
export function circuitFile(name: string, components: readonly FileComponentSpec[], wires: readonly [string, string][]) {
  const ref = (spec: string, defaultPin: string) => {
    const [componentId, pinId = defaultPin] = spec.split('.');
    return { componentId, pinId };
  };
  return {
    format: 'logic-sim',
    version: 1,
    name,
    components: components.map(([id, type, x, y, label, props]) => ({
      id,
      type,
      position: { x, y },
      ...(label ? { label } : {}),
      // Полные свойства, как их сохраняет редактор: иначе загрузка сообщит о нормализации.
      props: { ...defaultProps(type), ...props },
    })),
    wires: wires.map(([from, to], i) => ({ id: `w${i + 1}`, from: ref(from, 'out0'), to: ref(to, 'in0') })),
  };
}

/** Открывает схему через «Открыть» (или другой `trigger`) и системный выбор файла. */
export async function openCircuit(page: Page, document: unknown, trigger?: () => Promise<void>) {
  const chooser = page.waitForEvent('filechooser');
  await (trigger ? trigger() : page.getByTestId('file-open').click());
  await (await chooser).setFiles({
    name: 'circuit.lsim',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(document)),
  });
}

export const compilations = async (page: Page) =>
  Number(await page.getByTestId('status-bar').getAttribute('data-compilations'));

export { center };
