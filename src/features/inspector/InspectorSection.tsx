import type { ReactNode } from 'react';

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-800 px-4 py-3 first:border-t-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      {children}
    </section>
  );
}
