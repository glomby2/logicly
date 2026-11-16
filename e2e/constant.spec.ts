import { expect, test } from '@playwright/test';
import { circuitFile, nodesOfType, openCircuit } from './support';

/*
 * CONSTANT: постоянный уровень. Не переключается кликом (нет роли внешнего входа),
 * уровень меняется свойством в инспекторе (шаг истории), в таблице истинности не столбец.
 */

test.describe('CONSTANT', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('palette')).toBeVisible();
  });

  test('палитра «Ввод и вывод»; клик по узлу не меняет уровень; уровень — свойство в инспекторе с Undo', async ({ page }) => {
    await page.getByTestId('palette-CONSTANT').click();
    const node = nodesOfType(page, 'CONSTANT');
    await expect(node).toHaveCount(1);
    await expect(node).toHaveAttribute('aria-label', 'CONSTANT 1');
    await expect(node).toHaveAttribute('data-value', '1');

    await node.click();
    await expect(node).toHaveAttribute('data-value', '1');
    const inspector = page.getByTestId('inspector');
    await expect(inspector.getByTestId('inspector-title')).toHaveText('CONSTANT');
    await expect(inspector.getByTestId('inspector-toggle')).toHaveCount(0);
    const level = inspector.getByTestId('prop-level');
    await expect(level).toBeChecked();

    await level.uncheck();
    await expect(node).toHaveAttribute('data-value', '0');
    await expect(node).toHaveAttribute('aria-label', 'CONSTANT 0');

    // Фокус на флажке инспектора: горячие клавиши в полях ввода не работают — отмена кнопкой тулбара.
    await page.getByTestId('undo').click();
    await expect(node).toHaveAttribute('data-value', '1');
    await expect(level).toBeChecked();

    await node.click({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    await expect(menu.getByTestId('prop-level')).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Переключить/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('таблица истинности: CONSTANT — не столбец входа (MUX с D0 = 0, D1 = 1 зависит только от S)', async ({ page }) => {
    const document = circuitFile(
      'Константы',
      [
        ['K0', 'CONSTANT', 0, 0, undefined, { level: false }],
        ['K1', 'CONSTANT', 0, 60],
        ['S', 'INPUT', 0, 160, 'S'],
        ['M', 'MUX', 200, 20],
        ['Y', 'OUTPUT', 400, 30, 'Y'],
      ],
      [
        ['K0', 'M.d0'],
        ['K1', 'M.d1'],
        ['S', 'M.s0'],
        ['M.y', 'Y'],
      ],
    );
    await openCircuit(page, document);
    await expect(page.getByTestId('node-K0')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('node-K1')).toHaveAttribute('data-value', '1');
    await page.getByTestId('open-truth-table').click();
    await expect(page.getByTestId('truth-table-input')).toHaveText(['S']);
    await expect(page.getByTestId('truth-table-output')).toHaveText(['Y']);
    const rows = await page
      .getByTestId('truth-table-row')
      .evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent).join('')));
    expect(rows).toEqual(['00', '11']);
  });
});
