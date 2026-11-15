/** Значок генератора тактов — меандр. Цвет берётся из `currentColor`. */
export function SquareWave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
      <path d="M1 13 H6 V3 H12 V13 H18 V3 H23" />
    </svg>
  );
}
