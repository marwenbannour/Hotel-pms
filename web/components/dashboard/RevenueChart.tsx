'use client';

import { useI18n } from '@/lib/lang-context';
import type { Dashboard } from '@/lib/types';
import { CARD, CardLink, CardTitle } from './card';

const DAYS = 7;

/**
 * Revenus des 7 derniers jours (barres) et occupation (courbe), réalisés uniquement.
 * Barres en HTML : l'axe du temps s'inverse naturellement en arabe ; la courbe suit (miroir).
 */
export function RevenueChart({ data, allowed }: { data: Dashboard; allowed: Set<string> }) {
  const { t, f } = useI18n(data.kpis?.currency);
  const days = (data.kpis?.trend ?? []).filter((d) => !d.forecast).slice(-DAYS);
  if (days.length === 0) return null;
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const points = days
    .map((d, i) => `${((i + 0.5) / days.length) * 100},${100 - Math.min(d.occupancyRate, 100)}`)
    .join(' ');

  return (
    <section aria-labelledby="revenue-title" className={`${CARD} flex flex-col gap-4 p-5`}>
      <CardTitle id="revenue-title">{t.revenueWeek}</CardTitle>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-soft" aria-hidden>
        <li className="flex items-center gap-2"><span className="h-2.5 w-4 rounded-sm bg-navy" />{t.revenue}</li>
        <li className="flex items-center gap-2"><span className="h-0.5 w-4 rounded bg-gold" />{t.occupancy}</li>
      </ul>

      <figure className="grid flex-1 grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2">
          <div className="flex h-44 flex-col justify-between text-end text-[11px] leading-none text-ink-faint" aria-hidden>
            <span>{f.money(max)}</span>
            <span>{f.money(max / 2)}</span>
            <span>0</span>
          </div>
          <div className="relative h-44 flex-1 border-b border-line">
            {[0, 50].map((v) => (
              <div key={v} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${v}%` }} aria-hidden />
            ))}
            <ul className="relative flex h-full items-end gap-3 px-1">
              {days.map((d) => {
                const label = `${f.shortDate(d.date)} : ${f.money(d.revenue)}, ${t.occupancy} ${f.percent(d.occupancyRate)}`;
                return (
                  <li key={d.date} className="flex h-full flex-1 items-end justify-center" aria-label={label} title={label}>
                    <span
                      className={`block w-full max-w-7 rounded-t-md bg-navy ${d.date === data.date ? 'ring-2 ring-gold ring-offset-1' : ''}`}
                      style={{ height: `${Math.max((d.revenue / max) * 100, 1.5)}%` }}
                    />
                  </li>
                );
              })}
            </ul>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full rtl:-scale-x-100" aria-hidden>
              <polyline points={points} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="flex h-44 flex-col justify-between text-[11px] leading-none text-ink-faint" aria-hidden>
            <span>{f.percent(100)}</span>
            <span>{f.percent(50)}</span>
            <span>{f.percent(0)}</span>
          </div>
          <div className="col-start-2 mt-2 flex gap-3 px-1 text-center text-[11px] text-ink-faint" aria-hidden>
            {days.map((d) => (
              <span key={d.date} className={`flex-1 whitespace-nowrap ${d.date === data.date ? 'font-semibold text-brass' : ''}`}>
                {f.weekdayShort(d.date)} {f.dayOfMonth(d.date)}
              </span>
            ))}
          </div>
      </figure>

      <CardLink href="/reports" allowed={allowed}>{t.seeReport}</CardLink>
    </section>
  );
}
