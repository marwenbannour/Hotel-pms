'use client';

import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { useI18n } from '@/lib/lang-context';
import type { Dashboard } from '@/lib/types';

const SEVERITY = {
  critical: { icon: CircleAlert, className: 'text-maintenance', bar: 'bg-maintenance' },
  warning: { icon: TriangleAlert, className: 'text-brass', bar: 'bg-cleaning' },
  info: { icon: Info, className: 'text-ink-soft', bar: 'bg-line' },
} as const;

/** Colonne « À traiter » : ce que la personne à l'accueil doit faire maintenant. */
export function TodayPanel({ data }: { data: Dashboard }) {
  const { t, f } = useI18n();
  const mv = data.movements;
  const occ = data.kpis?.today;
  const alerts = data.alerts ?? [];

  const figures = [
    mv && { value: mv.arrivalsPending, label: t.arrivalsPending },
    mv && { value: mv.departuresPending, label: t.departuresPending },
    mv && { value: mv.inHouse, label: t.inHouse },
    occ && { value: f.percent(occ.occupancyRate), label: `${t.occupancy} (${occ.roomsSold}/${occ.roomsAvailable})` },
  ].filter(Boolean) as { value: number | string; label: string }[];

  return (
    <section aria-labelledby="today-title" className="space-y-5">
      <h2 id="today-title" className="text-xl font-semibold tracking-tight">{t.toHandle}</h2>

      {figures.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          {figures.map((fig) => (
            <div key={fig.label}>
              <dd className="text-3xl leading-9 font-semibold">{fig.value}</dd>
              <dt className="text-[13px] leading-5 text-ink-soft">{fig.label}</dt>
            </div>
          ))}
        </dl>
      )}

      {alerts.length === 0 ? (
        <p className="text-ink-soft">{t.nothingToHandle}</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const s = SEVERITY[a.severity];
            const Icon = s.icon;
            return (
              <li key={`${a.type}-${a.message}`} className="relative flex gap-3 overflow-hidden rounded-md bg-surface py-3 ps-4 pe-3 ring-1 ring-line">
                <span className={`absolute inset-y-0 start-0 w-1 ${s.bar}`} aria-hidden />
                <Icon className={`mt-0.5 size-[18px] shrink-0 ${s.className}`} aria-hidden />
                <span className="text-[14px] leading-5">{a.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
