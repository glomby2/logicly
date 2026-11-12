import { useRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  readonly value: string;
  /** Вызывается, если значение изменилось и подтверждено: Enter или потеря фокуса. */
  readonly onCommit: (value: string) => void;
  /** Вызывается после завершения редактирования любым способом (Enter, Esc, потеря фокуса). */
  readonly onFinish?: () => void;
}

/**
 * Текстовое поле с подтверждением: изменение применяется один раз по Enter или при уходе
 * из поля, поэтому правка — один шаг истории. Esc отменяет правку. Для сброса черновика
 * при смене объекта задайте компоненту `key`.
 */
export function TextField({ value, onCommit, onFinish, className, ...rest }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  // Esc вызывает blur раньше, чем обновится состояние, — флаг не даёт применить черновик.
  const cancelled = useRef(false);

  const finish = () => {
    if (!cancelled.current && draft !== value) onCommit(draft);
    cancelled.current = false;
    onFinish?.();
  };

  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          cancelled.current = true;
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        'w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100',
        'outline-none placeholder:text-slate-600 focus:border-sky-500',
        className,
      )}
    />
  );
}
