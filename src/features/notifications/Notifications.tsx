import { AlertTriangle, Info, X } from 'lucide-react';
import { useEffect } from 'react';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/cn';
import type { AppNotification } from '@/store';
import { appStores, useUiStore } from '@/store/hooks';

/** Время показа уведомления, мс. Повтор сообщения перезапускает отсчёт. */
const VISIBLE_MS = 4000;

function Toast({ notification }: { notification: AppNotification }) {
  const { id, revision, tone, message, count } = notification;

  useEffect(() => {
    const timer = window.setTimeout(() => appStores.ui.getState().dismissNotification(id), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [id, revision]);

  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg shadow-black/40',
        tone === 'warning' ? 'border-amber-500/50 bg-slate-900 text-amber-100' : 'border-sky-500/40 bg-slate-900 text-slate-100',
      )}
      data-testid="notification"
      data-tone={tone}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', tone === 'warning' ? 'text-amber-400' : 'text-sky-400')} aria-hidden />
      <span className="flex-1">
        {message}
        {count > 1 && (
          <span className="ml-1.5 rounded bg-slate-700 px-1 text-xs text-slate-300" data-testid="notification-count">
            ×{count}
          </span>
        )}
      </span>
      <button
        type="button"
        className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        aria-label={ru.notifications.dismiss}
        onClick={() => appStores.ui.getState().dismissNotification(id)}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function Notifications() {
  const notifications = useUiStore((s) => s.notifications);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ru.notifications.region}
      className="pointer-events-none fixed inset-x-0 bottom-10 z-40 flex flex-col items-center gap-2 px-4"
    >
      {notifications.map((notification) => (
        <div key={notification.id} className="w-full max-w-md">
          <Toast notification={notification} />
        </div>
      ))}
    </div>
  );
}
