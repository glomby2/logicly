import { CircuitBoard } from 'lucide-react';
import { ru } from '@/i18n/ru';

/** Временная страница-заглушка до появления редактора. */
export function App() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="max-w-md text-center">
        <CircuitBoard className="mx-auto mb-4 size-12 text-emerald-500" aria-hidden />
        <h1 className="text-2xl font-semibold">{ru.app.title}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{ru.app.subtitle}</p>
        <p className="mt-6 text-sm text-slate-500">{ru.app.placeholder}</p>
      </div>
    </main>
  );
}
