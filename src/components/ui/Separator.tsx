import { cn } from '@/lib/cn';

export function Separator({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn(vertical ? 'mx-1 h-6 w-px' : 'my-1 h-px w-full', 'bg-slate-700/70', className)}
    />
  );
}
