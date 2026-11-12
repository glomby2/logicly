import type { PropValue } from '@/core/types/circuit';
import type { PropSpec } from '@/core/types/element';
import { cn } from '@/lib/cn';
import { NumberStepper } from './NumberStepper';

interface PropFieldProps {
  readonly spec: PropSpec;
  readonly value: PropValue | undefined;
  readonly onChange: (value: number | boolean) => void;
  readonly className?: string;
}

/**
 * Редактор одного свойства элемента по его описанию из `propSchema`:
 * целое число — счётчик, логическое — флажок. Общий для инспектора и контекстного меню.
 */
export function PropField({ spec, value, onChange, className }: PropFieldProps) {
  const row = cn('flex items-center justify-between gap-3 text-sm text-slate-200', className);

  if (spec.kind === 'boolean') {
    return (
      <label className={row}>
        {spec.label}
        <input
          type="checkbox"
          className="size-4 accent-sky-500"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          data-testid={`prop-${spec.key}`}
        />
      </label>
    );
  }

  return (
    <div className={row}>
      <span>{spec.label}</span>
      <NumberStepper
        value={typeof value === 'number' ? value : spec.min}
        min={spec.min}
        max={spec.max}
        label={spec.label}
        onChange={onChange}
        testId={`prop-${spec.key}`}
      />
    </div>
  );
}
