import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './IconButton';

interface DialogProps {
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly testId?: string;
}

/**
 * Модальное окно: затемнение фона, закрытие кнопкой и кликом по фону.
 * Esc обрабатывает общий обработчик клавиш редактора (он закрывает открытый диалог).
 */
export function Dialog({ title, closeLabel, onClose, children, testId }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-lg flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl outline-none"
        data-testid={testId}
      >
        <header className="flex items-center justify-between border-b border-slate-800 py-2 pr-2 pl-5">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <IconButton label={closeLabel} icon={X} onClick={onClose} />
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
