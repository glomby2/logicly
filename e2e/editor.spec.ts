import { expect, test, type Page } from '@playwright/test';
import {
  center,
  compilations,
  dragBy,
  drawWire,
  dropElement,
  nodesOfType,
  pin,
  startWire,
  wires,
} from './support';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('palette')).toBeVisible();
});

/** INPUT (x=100) → AND (x=300) ← INPUT; AND → OUTPUT (x=500). Возвращает id элементов. */
async function andCircuit(page: Page) {
  const a = await dropElement(page, 'INPUT', { x: 120, y: 150 });
  const b = await dropElement(page, 'INPUT', { x: 120, y: 260 });
  const g = await dropElement(page, 'AND', { x: 340, y: 200 });
  const l = await dropElement(page, 'OUTPUT', { x: 560, y: 200 });
  await drawWire(page, pin(page, a, 'out0'), pin(page, g, 'in0'));
  await drawWire(page, pin(page, b, 'out0'), pin(page, g, 'in1'));
  await drawWire(page, pin(page, g, 'out0'), pin(page, l, 'in0'));
  await expect(wires(page)).toHaveCount(3);
  return { a, b, g, l };
}

test.describe('рабочее поле', () => {
  test('палитра, сетка, мини-карта и кнопки масштаба', async ({ page }) => {
    for (const type of ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR']) {
      await expect(page.getByTestId(`palette-${type}`)).toBeVisible();
    }
    await expect(page.locator('.react-flow__background')).toBeVisible();
    await expect(page.locator('.react-flow__minimap')).toBeVisible();
    await expect(page.getByTestId('status-bar')).toContainText('Перетащите элементы');
  });

  test('масштаб кнопками и колёсиком, вписывание в экран', async ({ page }) => {
    await dropElement(page, 'AND', { x: 300, y: 200 });
    const viewport = page.locator('.react-flow__viewport');
    const scale = async () => Number((await viewport.getAttribute('style'))!.match(/scale\(([\d.]+)\)/)![1]);

    // Каждый шаг кнопки — ×1.2; дожидаемся окончания анимации.
    expect(await scale()).toBe(1);
    await page.getByTestId('zoom-in').click();
    await expect.poll(scale).toBeCloseTo(1.2, 2);
    await page.getByTestId('zoom-out').click();
    await expect.poll(scale).toBeCloseTo(1, 2);
    await page.getByTestId('zoom-out').click();
    await expect.poll(scale).toBeCloseTo(1 / 1.2, 2);

    const canvas = await center(page.locator('[data-canvas]'));
    await page.mouse.move(canvas.x, canvas.y);
    const beforeWheel = await scale();
    await page.mouse.wheel(0, -400);
    await expect.poll(scale).toBeGreaterThan(beforeWheel);

    await page.getByTestId('fit-view').click();
    await expect(nodesOfType(page, 'AND')).toBeInViewport();
  });

  test('панорамирование перетаскиванием пустого поля', async ({ page }) => {
    const viewport = page.locator('.react-flow__viewport');
    const before = await viewport.getAttribute('style');
    await dragBy(page, page.locator('.react-flow__pane'), 120, 60);
    await expect.poll(() => viewport.getAttribute('style')).not.toBe(before);
  });
});

test.describe('узкий экран', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('палитра скрыта, открывается кнопкой и закрывается после добавления элемента', async ({ page }) => {
    const palette = page.getByTestId('palette');
    await expect(palette).not.toBeInViewport();
    await page.getByTestId('toggle-palette').click();
    await expect(palette).toBeInViewport();
    await page.getByTestId('palette-AND').click();
    await expect(nodesOfType(page, 'AND')).toHaveCount(1);
    await expect(palette).not.toBeInViewport();
    await expect(nodesOfType(page, 'AND')).toBeInViewport();
  });
});

test.describe('элементы', () => {
  test('первый элемент ложится под курсор, а поле не сдвигается', async ({ page }) => {
    const viewport = page.locator('.react-flow__viewport');
    const before = await viewport.getAttribute('style');
    const id = await dropElement(page, 'AND', { x: 400, y: 300 });
    await page.waitForTimeout(300);
    expect(await viewport.getAttribute('style')).toBe(before);

    const canvas = (await page.locator('[data-canvas]').boundingBox())!;
    const node = await center(page.getByTestId(`node-${id}`));
    expect(Math.abs(node.x - (canvas.x + 400))).toBeLessThanOrEqual(10);
    expect(Math.abs(node.y - (canvas.y + 300))).toBeLessThanOrEqual(10);
  });

  test('перетаскивание из палитры и добавление кликом; автоподписи INPUT/OUTPUT', async ({ page }) => {
    const id = await dropElement(page, 'INPUT', { x: 200, y: 200 });
    await expect(page.getByTestId(`node-${id}`)).toContainText('X1');
    await page.getByTestId('palette-OUTPUT').click();
    await expect(nodesOfType(page, 'OUTPUT')).toHaveCount(1);
    await expect(nodesOfType(page, 'OUTPUT')).toContainText('Y1');
    await expect(page.getByTestId('status-bar')).toContainText('Элементов: 2');
  });

  test('все вентили отображаются ANSI-символами с правильным числом входов', async ({ page }) => {
    const types = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'];
    for (const [i, type] of types.entries()) {
      const id = await dropElement(page, type, { x: 120 + (i % 4) * 160, y: 140 + Math.floor(i / 4) * 160 });
      const node = page.getByTestId(`node-${id}`);
      await expect(node.locator('svg path').first()).toBeVisible();
      const expectedInputs = type === 'NOT' ? 1 : 2;
      await expect(node.locator('[data-testid*="-in"]')).toHaveCount(expectedInputs);
      // Инвертирующие вентили имеют кружок на выходе.
      await expect(node.locator('svg circle')).toHaveCount(['NOT', 'NAND', 'NOR', 'XNOR'].includes(type) ? 1 : 0);
    }
  });

  test('перемещение элемента не перекомпилирует схему', async ({ page }) => {
    const { g } = await andCircuit(page);
    const before = await compilations(page);
    const node = page.getByTestId(`node-${g}`);
    const start = await node.boundingBox();
    await dragBy(page, node, 80, 60);
    const end = await node.boundingBox();
    expect(end!.x - start!.x).toBeGreaterThan(60);
    expect(await compilations(page)).toBe(before);
  });
});

test.describe('соединения', () => {
  test('провод от выхода к входу и от входа к выходу', async ({ page }) => {
    const a = await dropElement(page, 'INPUT', { x: 120, y: 150 });
    const n = await dropElement(page, 'NOT', { x: 340, y: 150 });
    const l = await dropElement(page, 'OUTPUT', { x: 560, y: 150 });

    await drawWire(page, pin(page, a, 'out0'), pin(page, n, 'in0'));
    // Обратное направление: от входа OUTPUT к выходу NOT.
    await drawWire(page, pin(page, l, 'in0'), pin(page, n, 'out0'));
    await expect(wires(page)).toHaveCount(2);
    await expect(pin(page, n, 'in0')).not.toHaveAttribute('data-floating', 'true');

    // Направление определено верно: сигнал идёт INPUT → NOT → OUTPUT.
    await expect(page.getByTestId(`node-${l}`)).toHaveAttribute('data-value', '1');
    await page.getByTestId(`input-toggle-${a}`).click();
    await expect(page.getByTestId(`node-${l}`)).toHaveAttribute('data-value', '0');
  });

  test('неподключённые входы выделены, подсветка допустимых пинов при протягивании', async ({ page }) => {
    const a = await dropElement(page, 'INPUT', { x: 120, y: 150 });
    const b = await dropElement(page, 'INPUT', { x: 120, y: 300 });
    const g = await dropElement(page, 'AND', { x: 340, y: 200 });
    await expect(pin(page, g, 'in0')).toHaveAttribute('data-floating', 'true');

    await startWire(page, pin(page, a, 'out0'), { x: 700, y: 500 });
    await expect(pin(page, a, 'out0')).toHaveAttribute('data-connect', 'source');
    await expect(pin(page, g, 'in0')).toHaveAttribute('data-connect', 'valid');
    await expect(pin(page, b, 'out0')).toHaveAttribute('data-connect', 'invalid');
    await page.mouse.up();
    await expect(pin(page, g, 'in0')).not.toHaveAttribute('data-connect');
  });

  test('некорректное соединение выход → выход не создаётся', async ({ page }) => {
    const a = await dropElement(page, 'INPUT', { x: 120, y: 150 });
    const b = await dropElement(page, 'INPUT', { x: 120, y: 300 });
    await drawWire(page, pin(page, a, 'out0'), pin(page, b, 'out0'));
    await expect(wires(page)).toHaveCount(0);
  });

  test('один выход на несколько входов; новый провод заменяет старый на занятом входе', async ({ page }) => {
    const a = await dropElement(page, 'INPUT', { x: 120, y: 150 });
    const b = await dropElement(page, 'INPUT', { x: 120, y: 320 });
    const g = await dropElement(page, 'AND', { x: 340, y: 220 });
    await drawWire(page, pin(page, a, 'out0'), pin(page, g, 'in0'));
    await drawWire(page, pin(page, a, 'out0'), pin(page, g, 'in1'));
    await expect(wires(page)).toHaveCount(2);

    await page.getByTestId(`input-toggle-${a}`).click();
    await expect(page.getByTestId(`node-${g}`)).toHaveAttribute('data-output', '1');

    // B на занятый вход in1: провод от A к in1 заменяется.
    await drawWire(page, pin(page, b, 'out0'), pin(page, g, 'in1'));
    await expect(wires(page)).toHaveCount(2);
    await expect(page.getByTestId(`node-${g}`)).toHaveAttribute('data-output', '0');
  });

  test('переподключение конца провода и удаление броском на пустое место', async ({ page }) => {
    const a = await dropElement(page, 'INPUT', { x: 120, y: 150 });
    const g = await dropElement(page, 'AND', { x: 340, y: 150 });
    await drawWire(page, pin(page, a, 'out0'), pin(page, g, 'in0'));
    await page.getByTestId(`input-toggle-${a}`).click();
    await expect(pin(page, g, 'in0')).toHaveAttribute('data-signal', '1');

    // Ручка переподключения находится чуть левее входного пина.
    const in0 = await center(pin(page, g, 'in0'));
    const in1 = await center(pin(page, g, 'in1'));
    await page.mouse.move(in0.x - 22, in0.y);
    await page.mouse.down();
    await page.mouse.move(in1.x, in1.y, { steps: 12 });
    await page.mouse.up();
    await expect(wires(page)).toHaveCount(1);
    await expect(pin(page, g, 'in1')).toHaveAttribute('data-signal', '1');
    await expect(pin(page, g, 'in0')).toHaveAttribute('data-floating', 'true');

    await page.mouse.move(in1.x - 22, in1.y);
    await page.mouse.down();
    await page.mouse.move(in1.x + 150, in1.y + 250, { steps: 12 });
    await page.mouse.up();
    await expect(wires(page)).toHaveCount(0);
  });
});

test.describe('симуляция', () => {
  test('INPUT переключается кликом, сигналы обновляются сразу; цвета 0 и 1 различаются', async ({ page }) => {
    const { a, b, g, l } = await andCircuit(page);
    const output = page.getByTestId(`node-${l}`);
    const wireOut = page.locator(`[data-testid^="wire-"][data-signal]`);

    await expect(output).toHaveAttribute('data-value', '0');
    await page.getByTestId(`input-toggle-${a}`).click();
    await expect(output).toHaveAttribute('data-value', '0');
    await page.getByTestId(`input-toggle-${b}`).click();
    await expect(output).toHaveAttribute('data-value', '1');
    await expect(page.getByTestId(`node-${g}`)).toHaveAttribute('data-output', '1');
    await expect(wireOut.and(page.locator('[data-signal="1"]'))).toHaveCount(3);

    const colors = await wireOut.evaluateAll((paths) => paths.map((p) => getComputedStyle(p).stroke));
    await page.getByTestId(`input-toggle-${a}`).click();
    const after = await wireOut.evaluateAll((paths) => paths.map((p) => getComputedStyle(p).stroke));
    expect(new Set([...colors, ...after]).size).toBe(2);
  });

  test('переключение INPUT не перекомпилирует схему', async ({ page }) => {
    const { a } = await andCircuit(page);
    const before = await compilations(page);
    await page.getByTestId(`input-toggle-${a}`).click();
    await page.getByTestId(`input-toggle-${a}`).click();
    expect(await compilations(page)).toBe(before);
  });

  test('нестабильная схема (NOT на себя) показывает X и предупреждение', async ({ page }) => {
    const n = await dropElement(page, 'NOT', { x: 300, y: 200 });
    const l = await dropElement(page, 'OUTPUT', { x: 520, y: 200 });
    await drawWire(page, pin(page, n, 'out0'), pin(page, n, 'in0'));
    await drawWire(page, pin(page, n, 'out0'), pin(page, l, 'in0'));
    await expect(page.getByTestId(`node-${l}`)).toHaveAttribute('data-value', 'X');
    await expect(page.locator('[data-testid^="wire-"][data-signal="X"]')).toHaveCount(2);
    await expect(page.getByTestId('status-unknown')).toBeVisible();
  });
});

test.describe('управление', () => {
  test('выделение кликом, удаление Delete и Backspace вместе с проводами', async ({ page }) => {
    const { g, l } = await andCircuit(page);
    await page.getByTestId(`node-${g}`).click();
    await page.keyboard.press('Delete');
    await expect(nodesOfType(page, 'AND')).toHaveCount(0);
    await expect(wires(page)).toHaveCount(0);

    await page.getByTestId(`node-${l}`).click();
    await page.keyboard.press('Backspace');
    await expect(nodesOfType(page, 'OUTPUT')).toHaveCount(0);
  });

  test('множественное выделение: Shift+клик и рамка с Shift', async ({ page }) => {
    const a = await dropElement(page, 'AND', { x: 150, y: 150 });
    const b = await dropElement(page, 'OR', { x: 350, y: 150 });
    await dropElement(page, 'NOT', { x: 600, y: 450 });

    await page.getByTestId(`node-${a}`).click();
    await page.getByTestId(`node-${b}`).click({ modifiers: ['Shift'] });
    await page.keyboard.press('Delete');
    await expect(nodesOfType(page, 'AND')).toHaveCount(0);
    await expect(nodesOfType(page, 'OR')).toHaveCount(0);
    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await expect(nodesOfType(page, 'AND')).toHaveCount(1);

    // Рамка с Shift вокруг AND и OR.
    const canvas = (await page.locator('[data-canvas]').boundingBox())!;
    await page.keyboard.down('Shift');
    await page.mouse.move(canvas.x + 60, canvas.y + 60);
    await page.mouse.down();
    await page.mouse.move(canvas.x + 480, canvas.y + 280, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.keyboard.press('Delete');
    await expect(nodesOfType(page, 'AND')).toHaveCount(0);
    await expect(nodesOfType(page, 'OR')).toHaveCount(0);
    await expect(nodesOfType(page, 'NOT')).toHaveCount(1);
  });

  test('выделение и удаление провода', async ({ page }) => {
    const a = await dropElement(page, 'INPUT', { x: 150, y: 200 });
    const l = await dropElement(page, 'OUTPUT', { x: 450, y: 200 });
    await drawWire(page, pin(page, a, 'out0'), pin(page, l, 'in0'));
    // INPUT и OUTPUT на одной высоте — провод прямой, середина лежит на нём.
    const from = await center(pin(page, a, 'out0'));
    const to = await center(pin(page, l, 'in0'));
    await page.mouse.click((from.x + to.x) / 2, (from.y + to.y) / 2);
    await page.keyboard.press('Delete');
    await expect(wires(page)).toHaveCount(0);
    await expect(nodesOfType(page, 'INPUT')).toHaveCount(1);
  });

  test('копирование, вставка и дублирование', async ({ page }) => {
    const { a, g } = await andCircuit(page);
    await page.getByTestId(`node-${g}`).click();
    await page.getByTestId(`node-${a}`).click({ modifiers: ['Shift'] });
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await expect(nodesOfType(page, 'AND')).toHaveCount(2);
    await expect(nodesOfType(page, 'INPUT')).toHaveCount(3);
    // Скопирован и провод между выделенными элементами.
    await expect(wires(page)).toHaveCount(4);

    await page.keyboard.press('Control+d');
    await expect(nodesOfType(page, 'AND')).toHaveCount(3);
  });

  test('Ctrl+Z и Ctrl+Y', async ({ page }) => {
    await dropElement(page, 'AND', { x: 200, y: 200 });
    await dropElement(page, 'OR', { x: 400, y: 200 });
    await page.keyboard.press('Control+z');
    await expect(nodesOfType(page, 'OR')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(nodesOfType(page, 'AND')).toHaveCount(0);
    await page.keyboard.press('Control+y');
    await expect(nodesOfType(page, 'AND')).toHaveCount(1);
    await page.keyboard.press('Control+Shift+z');
    await expect(nodesOfType(page, 'OR')).toHaveCount(1);
  });

  test('контекстное меню: число входов, переименование, удаление; меню поля', async ({ page }) => {
    const g = await dropElement(page, 'AND', { x: 300, y: 200 });
    const node = page.getByTestId(`node-${g}`);

    await node.click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: /\+1/ }).click();
    await expect(menu.getByTestId('prop-inputCount')).toHaveText('3');
    await expect(pin(page, g, 'in2')).toBeAttached();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await node.click({ button: 'right' });
    await menu.getByRole('menuitem', { name: 'Переименовать' }).click();
    await page.getByTestId('rename-input').fill('G1');
    await page.keyboard.press('Enter');
    await expect(node).toContainText('G1');

    await node.click({ button: 'right' });
    await menu.getByRole('menuitem', { name: /Удалить/ }).click();
    await expect(nodesOfType(page, 'AND')).toHaveCount(0);

    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 400, y: 300 } });
    await expect(menu.getByRole('menuitem', { name: /Вставить/ })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: /Выделить всё/ })).toBeEnabled();
  });

  test('переключение INPUT из контекстного меню', async ({ page }) => {
    const a = await dropElement(page, 'INPUT', { x: 200, y: 200 });
    await page.getByTestId(`node-${a}`).click({ button: 'right', position: { x: 55, y: 20 } });
    await page.getByTestId('context-menu').getByRole('menuitem', { name: 'Переключить' }).click();
    await expect(page.getByTestId(`input-toggle-${a}`)).toHaveAttribute('aria-pressed', 'true');
  });
});
