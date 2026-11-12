import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

interface NumberStepperProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** Подпись для `aria-label` кнопок: «<label>: −1» / «<label>: +1». */
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly testId?: string;
  readonly className?: string;
}

const BUTTON = 'rounded p-1 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent';

export function NumberStepper({ value, min, max, label, onChange, testId, className }: NumberStepperProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        className={BUTTON}
        disabled={value <= min}
        aria-label={`${label}: −1`}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-6 text-center font-mono text-sm text-slate-100" data-testid={testId}>
        {value}
      </span>
      <button
        type="button"
        className={BUTTON}
        disabled={value >= max}
        aria-label={`${label}: +1`}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
