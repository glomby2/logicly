import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { SIGNAL_COLORS } from '@/editor/signalStyle';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/cn';
import type { CellTone, TruthCellView, TruthTableView as TableModel } from './truthTableModel';

type TableView = Extract<TableModel, { kind: 'table' }>;

/** 0, 1 и X — цвета сигналов, как на поле. «↺» — не сигнал, поэтому отдельный цвет. */
const TONE_STYLE: Readonly<Record<CellTone, CSSProperties>> = {
  zero: { color: SIGNAL_COLORS.low },
  one: { color: SIGNAL_COLORS.high },
  unknown: { color: SIGNAL_COLORS.unknown },
  memory: { color: '#c4b5fd' },
};

function Cell({ cell, divider = false }: { cell: TruthCellView; divider?: boolean }) {
  return (
    <td
      className={cn('px-3 py-1 text-center font-mono font-semibold', divider && 'border-l-2 border-slate-700')}
      style={TONE_STYLE[cell.tone]}
      title={cell.title}
      data-tone={cell.tone}
    >
      {cell.text}
    </td>
  );
}

function Legend() {
  const { legend } = ru.truthTable;
  const items: [string, CellTone, string][] = [
    ['0', 'zero', legend.zero],
    ['1', 'one', legend.one],
    ['X', 'unknown', legend.unknown],
    ['↺', 'memory', legend.memory],
  ];
  return (
    <section className="mt-3 text-xs text-slate-400" data-testid="truth-table-legend">
      <h3 className="mb-1 font-semibold uppercase tracking-wider text-slate-500">{legend.title}</h3>
      <dl className="grid grid-cols-[1.5rem_1fr] gap-x-2 gap-y-0.5">
        {items.map(([symbol, tone, text]) => (
          <div key={symbol} className="contents">
            <dt className="text-center font-mono font-semibold" style={TONE_STYLE[tone]}>
              {symbol}
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface TruthTableViewProps {
  readonly view: TableView;
  /** Строка текущей комбинации входов схемы; `-1` — не определена. */
  readonly currentRow: number;
  readonly onSelectRow: (index: number) => void;
}

/** Таблица: шапка закреплена, прокрутка по обеим осям внутри собственного контейнера. */
export function TruthTableView({ view, currentRow, onSelectRow }: TruthTableViewProps) {
  const current = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest' });
  }, [currentRow]);

  return (
    <div className="min-w-0">
      <p className="text-sm text-slate-300" data-testid="truth-table-summary">
        {view.summary}
      </p>
      {view.notes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {view.notes.map((note) => (
            <li key={note} className="flex items-start gap-1.5 text-xs text-amber-200/90" data-testid="truth-table-note">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" aria-hidden />
              {note}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">{ru.truthTable.hint}</p>

      <div
        className="mt-2 max-h-[min(55vh,28rem)] overflow-auto rounded-md border border-slate-800"
        data-testid="truth-table-scroll"
      >
        <table className="w-max min-w-full border-collapse text-sm" data-testid="truth-table">
          <thead className="sticky top-0 z-10 bg-slate-900">
            <tr className="text-[11px] uppercase tracking-wider text-slate-500">
              {view.inputs.length > 0 && (
                <th colSpan={view.inputs.length} className="px-3 pt-1.5 font-semibold">
                  {ru.truthTable.inputs}
                </th>
              )}
              <th colSpan={view.outputs.length} className={cn('px-3 pt-1.5 font-semibold', view.inputs.length > 0 && 'border-l-2 border-slate-700')}>
                {ru.truthTable.outputs}
              </th>
            </tr>
            <tr className="border-b border-slate-700 text-slate-200">
              {view.inputs.map((column) => (
                <th key={column.componentId} className="px-3 pb-1.5 font-semibold whitespace-nowrap" data-testid="truth-table-input">
                  {column.title}
                </th>
              ))}
              {view.outputs.map((column, i) => (
                <th
                  key={column.componentId}
                  className={cn(
                    'px-3 pb-1.5 font-semibold whitespace-nowrap',
                    i === 0 && view.inputs.length > 0 && 'border-l-2 border-slate-700',
                    column.hint && 'text-slate-500 underline decoration-dotted',
                  )}
                  title={column.hint}
                  data-testid="truth-table-output"
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row, index) => {
              const isCurrent = index === currentRow;
              return (
                <tr
                  key={index}
                  ref={isCurrent ? current : undefined}
                  tabIndex={0}
                  onClick={() => onSelectRow(index)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onSelectRow(index);
                  }}
                  title={row.unstable ? ru.truthTable.unstableRow : undefined}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={cn(
                    'cursor-pointer border-b border-slate-800/70 outline-none hover:bg-slate-800/60 focus-visible:bg-slate-800',
                    isCurrent && 'bg-sky-500/15 shadow-[inset_3px_0_0_#38bdf8] hover:bg-sky-500/20',
                  )}
                  data-testid="truth-table-row"
                  data-current={isCurrent || undefined}
                  data-unstable={row.unstable || undefined}
                >
                  {row.inputs.map((cell, i) => (
                    <Cell key={`i${i}`} cell={cell} />
                  ))}
                  {row.outputs.map((cell, i) => (
                    <Cell key={`o${i}`} cell={cell} divider={i === 0 && row.inputs.length > 0} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Legend />
    </div>
  );
}
