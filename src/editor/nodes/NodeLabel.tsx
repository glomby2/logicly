import { cn } from '@/lib/cn';

/** Подпись элемента над узлом. */
export function NodeLabel({ text, className }: { text?: string; className?: string }) {
  if (!text) return null;
  return (
    <div
      className={cn(
        'pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-slate-300',
        className,
      )}
    >
      {text}
    </div>
  );
}
