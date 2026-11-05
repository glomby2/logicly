import { describe, expect, it } from 'vitest';
import { createUiStore, EMPTY_SELECTION, selectIsSelected } from '@/store';
import { CircuitBuilder } from '../helpers/circuitBuilder';

describe('uiStore', () => {
  it('выделение', () => {
    const ui = createUiStore();
    ui.getState().select({ components: ['a'], wires: ['w1'] });
    expect(ui.getState().selection).toEqual({ components: ['a'], wires: ['w1'] });
    expect(selectIsSelected(ui.getState(), 'a')).toBe(true);
    ui.getState().clearSelection();
    expect(ui.getState().selection).toBe(EMPTY_SELECTION);
  });

  it('pruneSelection убирает исчезнувшие элементы и не создаёт лишних обновлений', () => {
    const ui = createUiStore();
    const circuit = new CircuitBuilder().input('A').gate('G', 'NOT').wire('A', 'G').build();
    ui.getState().select({ components: ['A', 'gone'], wires: ['w1', 'w-gone'] });
    ui.getState().pruneSelection(circuit);
    expect(ui.getState().selection).toEqual({ components: ['A'], wires: ['w1'] });

    const selection = ui.getState().selection;
    ui.getState().pruneSelection(circuit);
    expect(ui.getState().selection).toBe(selection);
  });

  it('панели, тема, диалог и режим размещения', () => {
    const ui = createUiStore();
    expect(ui.getState().panels).toEqual({ palette: true, inspector: true });
    ui.getState().togglePanel('palette');
    ui.getState().setPanel('inspector', false);
    expect(ui.getState().panels).toEqual({ palette: false, inspector: false });

    ui.getState().setTheme('dark');
    expect(ui.getState().theme).toBe('dark');

    ui.getState().openDialog('truth-table');
    expect(ui.getState().dialog).toBe('truth-table');
    ui.getState().closeDialog();
    expect(ui.getState().dialog).toBeNull();

    ui.getState().startPlacement('AND');
    expect(ui.getState().placement).toBe('AND');
    ui.getState().cancelPlacement();
    expect(ui.getState().placement).toBeNull();
  });
});
