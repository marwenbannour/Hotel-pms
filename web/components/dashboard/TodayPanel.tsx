'use client';

import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { useI18n } from '@/lib/lang-context';
import type { Dashboard } from '@/lib/types';
import { CARD, CardTitle } from './card';

export const SEVERITY = {
  critical: { icon: CircleAlert, className: 'text-maintenance', badge: 'bg-maintenance/10' },
  warning: { icon: TriangleAlert, className: 'text-cleaning-text', badge: 'bg-cleaning-soft' },
  info: { icon: Info, className: 'text-info-text', badge: 'bg-info-soft' },
} as const;

/** Carte « À traiter » : ce que l'équipe doit faire maintenant (alertes calculées par l'API). */
export function TodayPanel({ data }: { data: Dashboard }) {
  const { t } = useI18n();
  const alerts = data.alerts ?? [];

  return (
    <section aria-labelledby="today-title" className={`${CARD} flex flex-col gap-4 p-5`}>
      <CardTitle id="today-title">{t.toHandle}</CardTitle>
      {alerts.length === 0 ? (
        <p className="text-ink-soft">{t.nothingToHandle}</p>
      ) : (
        <ul className="divide-y divide-line">
          {alerts.map((a) => {
            const s = SEVERITY[a.severity];
            const Icon = s.icon;
            return (
              <li key={`${a.type}-${a.message}`} className="flex gap-3 py-3 first:pt-0">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${s.badge}`}>
                  <Icon className={`size-[18px] ${s.className}`} aria-hidden />
                </span>
                <span className="text-[14px] leading-5">{a.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
