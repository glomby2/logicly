import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Текст подсказки и `aria-label`. */
  readonly label: string;
  readonly icon: LucideIcon;
  readonly active?: boolean;
}

export function IconButton({ label, icon: Icon, active = false, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md text-slate-300 transition-colors',
        'hover:bg-slate-800 hover:text-slate-50 focus-visible:outline-2 focus-visible:outline-sky-500',
        'disabled:pointer-events-none disabled:opacity-35',
        active && 'bg-slate-800 text-sky-300',
        className,
      )}
      {...rest}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}
