import { AlertTriangle, CircleAlert, Info, X, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/cn';
import type { AppNotification, NotificationTone } from '@/store';
import { appStores, useUiStore } from '@/store/hooks';

/** Время показа уведомления, мс. Повтор сообщения перезапускает отсчёт. Ошибки скрываются только вручную. */
const VISIBLE_MS = 4000;

const TONES: Readonly<Record<NotificationTone, { icon: LucideIcon; box: string; iconColor: string }>> = {
  info: { icon: Info, box: 'border-sky-500/40 text-slate-100', iconColor: 'text-sky-400' },
  warning: { icon: AlertTriangle, box: 'border-amber-500/50 text-amber-100', iconColor: 'text-amber-400' },
  error: { icon: CircleAlert, box: 'border-rose-500/60 text-rose-100', iconColor: 'text-rose-400' },
};

function Toast({ notification }: { notification: AppNotification }) {
  const { id, revision, tone, message, count } = notification;

  useEffect(() => {
    if (tone === 'error') return;
    const timer = window.setTimeout(() => appStores.ui.getState().dismissNotification(id), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [id, revision, tone]);

  const { icon: Icon, box, iconColor } = TONES[tone];
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2 rounded-lg border bg-slate-900 px-3 py-2 text-sm shadow-lg shadow-black/40',
        box,
      )}
      role={tone === 'error' ? 'alert' : undefined}
      data-testid="notification"
      data-tone={tone}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconColor)} aria-hidden />
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
