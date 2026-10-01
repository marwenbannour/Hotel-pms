'use client';

import { useI18n } from '@/lib/lang-context';
import type { Dashboard } from '@/lib/types';

/** Indicateurs de la section 3.8, affichés uniquement pour les profils ayant accès aux montants. */
export function Performance({ data }: { data: Dashboard }) {
  const kpis = data.kpis!;
  const { t, f } = useI18n(kpis.currency);
  const trend = kpis.trend ?? [];
  const today = kpis.today;
  const month = kpis.monthToDate!;
  const max = Math.max(100, ...trend.map((d) => d.occupancyRate));

  const figures = [
    { label: t.adr, help: t.adrHelp, value: f.money(today.adr ?? 0) },
    { label: t.revpar, help: t.revparHelp, value: f.money(today.revpar ?? 0) },
    { label: t.revenueToday, value: f.money(today.revenue ?? 0) },
    { label: t.revenueMonth, help: `${t.occupancy} ${f.percent(month.occupancyRate)}`, value: f.money(month.revenue ?? 0) },
    { label: t.alos, value: `${f.number(month.averageLengthOfStay ?? 0)} ${t.nights}` },
  ];

  return (
    <section aria-labelledby="perf-title" className="rounded-lg bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 id="perf-title" className="text-xl font-semibold tracking-tight">{t.performance}</h2>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <figure>
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{t.trendTitle}</span>
            <span className="text-[13px] text-ink-faint">{t.trendHelp}</span>
          </figcaption>
          {/* Barres HTML plutôt que SVG : l'axe du temps s'inverse naturellement en arabe. */}
          <div className="relative mt-4">
          {[100, 50].map((v) => (
            <div
              key={v}
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line"
              style={{ bottom: `${(v / max) * 100}%` }}
              aria-hidden
            >
              <span className="absolute -top-2.5 end-0 bg-surface ps-1 text-[11px] leading-4 text-ink-faint">{f.percent(v)}</span>
            </div>
          ))}
          <div className="flex h-40 items-end gap-1.5 border-b border-line pe-10" role="list">
            {trend.map((d) => {
              const isToday = d.date === data.date;
              return (
                <div
                  key={d.date}
                  role="listitem"
                  aria-label={`${f.shortDate(d.date)} : ${f.percent(d.occupancyRate)}`}
                  title={`${f.shortDate(d.date)} : ${f.percent(d.occupancyRate)}`}
                  className="flex h-full flex-1 flex-col justify-end"
                >
                  <div
                    className={`min-h-[3px] rounded-t-[3px] ${d.forecast ? 'forecast' : 'bg-ink'} ${isToday ? 'ring-2 ring-brass ring-offset-1' : ''}`}
                    style={{ height: `${(d.occupancyRate / max) * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
          </div>
          <div className="mt-1.5 flex gap-1.5 pe-10 text-center text-[11px] text-ink-faint" aria-hidden>
            {trend.map((d) => (
              <span key={d.date} className={`flex-1 ${d.date === data.date ? 'font-semibold text-brass' : ''}`}>
                {f.dayOfMonth(d.date)}
              </span>
            ))}
          </div>
        </figure>

        <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-5">
          {figures.map((fig) => (
            <div key={fig.label}>
              <dt className="text-[13px] text-ink-soft">{fig.label}</dt>
              <dd className="text-2xl leading-8 font-semibold">{fig.value}</dd>
              {fig.help && <dd className="text-[12px] text-ink-faint">{fig.help}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
