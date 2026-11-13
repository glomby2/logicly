import { useState } from 'react';
import { buildTruthTable } from '@/core/analysis';
import { Dialog } from '@/components/ui/Dialog';
import { ru } from '@/i18n/ru';
import { appStores, useCircuitStore, useUiStore } from '@/store/hooks';
import { buildTruthTableView, currentRowIndex, rowCombination } from './truthTableModel';
import { TruthTableView } from './TruthTableView';

const { registry, commands, ui } = appStores;

/**
 * Содержимое диалога. Таблица строится один раз при открытии: диалог модальный, а выбор
 * строки меняет только положения INPUT, от которых таблица не зависит. Расчёт идёт на
 * собственных экземплярах движка — основная симуляция не затрагивается.
 */
function TruthTableContent() {
  const [{ result, view }] = useState(() => {
    const { circuit } = appStores.circuit.getState();
    const built = buildTruthTable(circuit, registry);
    return { result: built, view: buildTruthTableView(built, circuit, registry) };
  });
  // Текущая строка следует за положениями INPUT, в том числе после выбора строки.
  const currentRow = useCircuitStore((s) => (result.ok ? currentRowIndex(result.table, s.circuit) : -1));

  if (!result.ok || view.kind === 'message') {
    return (
      <p className="text-sm text-slate-300" data-testid="truth-table-message">
        {view.kind === 'message' ? view.text : null}
      </p>
    );
  }

  return (
    <TruthTableView
      view={view}
      currentRow={currentRow}
      onSelectRow={(index) => commands.applyInputCombination(rowCombination(result.table, index))}
    />
  );
}

export function TruthTableDialog() {
  const open = useUiStore((s) => s.dialog === 'truth-table');
  if (!open) return null;
  return (
    <Dialog
      title={ru.truthTable.title}
      closeLabel={ru.truthTable.close}
      onClose={() => ui.getState().closeDialog()}
      testId="truth-table-dialog"
      size="wide"
    >
      <TruthTableContent />
    </Dialog>
  );
}
