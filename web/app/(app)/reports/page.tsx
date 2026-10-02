'use client';

import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { Bar, BarChart } from '@/components/reports/BarChart';
import { Button, ErrorNote, fieldClass } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, nightsBetween } from '@/lib/dates';
import { REPORTS } from '@/lib/i18n-reports';
import { useI18n } from '@/lib/lang-context';
import { useMe } from '../shell';

interface DailyKpi {
  date: string;
  roomsAvailable: number;
  roomsSold: number;
  occupancyRate: number;
  revenue: number;
  adr: number;
  revpar: number;
}

interface KpiSummary {
  from: string;
  to: string;
  currency: string;
  totals: Omit<DailyKpi, 'date'> & { averageLengthOfStay: number; staysCount: number };
  daily: DailyKpi[];
}

const MAX_DAYS = 366;
/** Au-delà, une barre par jour devient illisible : regroupement par semaine. */
const WEEKLY_ABOVE = 62;

const monthStart = (d: string) => `${d.slice(0, 8)}01`;
const nextMonth = (d: string) => {
  const [y, m] = d.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
};
const prevMonth = (d: string) => {
  const [y, m] = d.split('-').map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
};

/** Plafond « rond » pour l'échelle du chiffre d'affaires. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

function Reports() {
  const { lang, f: fmt } = useI18n();
  const R = REPORTS[lang];
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = me.data?.hotel.today;

  const from = params.get('from') ?? (today ? monthStart(today) : '');
  // « to » est inclus dans l'URL et à l'écran ; l'API attend une borne exclue.
  const to = params.get('to') ?? (today ? addDays(nextMonth(today), -1) : '');
  const days = from && to ? nightsBetween(from, to) + 1 : 0;
  const valid = days >= 1 && days <= MAX_DAYS;
  const prevFrom = valid ? addDays(from, -days) : '';

  const [draft, setDraft] = useState({ from, to });
  useEffect(() => setDraft({ from, to }), [from, to]);
  const [showTable, setShowTable] = useState(false);

  const report = useQuery({
    queryKey: ['reports', 'kpis', from, to],
    queryFn: async () => (await api<KpiSummary>(`/reports/kpis?from=${from}&to=${addDays(to, 1)}`)).data,
    enabled: valid,
  });
  const previous = useQuery({
    queryKey: ['reports', 'kpis', prevFrom, from],
    queryFn: async () => (await api<KpiSummary>(`/reports/kpis?from=${prevFrom}&to=${from}`)).data,
    enabled: valid,
  });
  const { f } = useI18n(report.data?.currency ?? me.data?.hotel.currency);

  const setPeriod = (a: string, b: string) => router.replace(`${pathname}?from=${a}&to=${b}`, { scroll: false });
  const presets: [string, string, string][] = today
    ? [
        [R.presets.thisMonth, monthStart(today), addDays(nextMonth(today), -1)],
        [R.presets.lastMonth, prevMonth(today), addDays(monthStart(today), -1)],
        [R.presets.next30, today, addDays(today, 29)],
        [R.presets.thisYear, `${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`],
      ]
    : [];
  const draftDays = draft.from && draft.to ? nightsBetween(draft.from, draft.to) + 1 : 0;
  const draftValid = draftDays >= 1 && draftDays <= MAX_DAYS;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draftValid) setPeriod(draft.from, draft.to);
  };

  const data = report.data;
  const prev = previous.data;

  // Comparaison : écart en points pour un taux, en pourcentage pour un montant ou un volume.
  const delta = (cur: number, before: number | undefined, kind: 'points' | 'percent') => {
    if (before === undefined) return null;
    const d = kind === 'points' ? Math.round((cur - before) * 10) / 10 : before > 0 ? ((cur - before) / before) * 100 : null;
    if (d === null) return null;
    if (Math.abs(d) < 0.05) return `= ${R.noChange} ${R.vsPrevious}`;
    const sign = d > 0 ? '▲ +' : '▼ −';
    const v = fmt.number(Math.abs(d), 1);
    return `${sign}${kind === 'points' ? `${v} ${R.points}` : `${v} %`} ${R.vsPrevious}`;
  };

  const tiles = data
    ? [
        { label: R.occupancy, value: f.percent(data.totals.occupancyRate), delta: delta(data.totals.occupancyRate, prev?.totals.occupancyRate, 'points'), hero: true },
        { label: R.revenue, value: f.money(data.totals.revenue), delta: delta(data.totals.revenue, prev?.totals.revenue, 'percent'), hero: true },
        { label: R.adr, value: f.money(data.totals.adr), delta: delta(data.totals.adr, prev?.totals.adr, 'percent'), hero: true },
        { label: R.revpar, value: f.money(data.totals.revpar), delta: delta(data.totals.revpar, prev?.totals.revpar, 'percent'), hero: true },
        { label: R.roomNights, value: fmt.number(data.totals.roomsSold, 0), delta: delta(data.totals.roomsSold, prev?.totals.roomsSold, 'percent') },
        { label: R.stays, value: fmt.number(data.totals.staysCount, 0), delta: delta(data.totals.staysCount, prev?.totals.staysCount, 'percent') },
        { label: R.alos, value: R.nights(fmt.number(data.totals.averageLengthOfStay, 1)), delta: null },
      ]
    : [];

  // Regroupement : un point par jour, ou par tranche de 7 jours à partir du début de période.
  const weekly = (data?.daily.length ?? 0) > WEEKLY_ABOVE;
  const buckets = (() => {
    if (!data) return [];
    const size = weekly ? 7 : 1;
    const out: { start: string; end: string; sold: number; avail: number; revenue: number }[] = [];
    for (let i = 0; i < data.daily.length; i += size) {
      const chunk = data.daily.slice(i, i + size);
      out.push({
        start: chunk[0].date,
        end: chunk[chunk.length - 1].date,
        sold: chunk.reduce((s, d) => s + d.roomsSold, 0),
        avail: chunk.reduce((s, d) => s + d.roomsAvailable, 0),
        revenue: chunk.reduce((s, d) => s + d.revenue, 0),
      });
    }
    return out;
  })();
  // Étiquetage sélectif : au plus ~8 libellés sur l'axe.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));
  const isForecast = (end: string) => !!today && end > today;
  const titleOf = (b: (typeof buckets)[number]) => (weekly ? R.weekOf(fmt.dayMonth(b.start)) : fmt.shortDate(b.start));
  const axisOf = (b: (typeof buckets)[number], i: number) =>
    i % labelEvery === 0 ? (weekly ? fmt.dayMonth(b.start) : fmt.dayOfMonth(b.start)) : '';

  const occBars: Bar[] = buckets.map((b, i) => ({
    key: b.start,
    value: pct(b.sold, b.avail),
    axisLabel: axisOf(b, i),
    tooltipTitle: titleOf(b),
    tooltipLines: [f.percent(pct(b.sold, b.avail)), R.sold(b.sold, b.avail)],
    forecast: isForecast(b.end),
  }));
  const revMax = niceCeil(Math.max(0, ...buckets.map((b) => b.revenue)));
  const revBars: Bar[] = buckets.map((b, i) => ({
    key: b.start,
    value: b.revenue,
    axisLabel: axisOf(b, i),
    tooltipTitle: titleOf(b),
    tooltipLines: [f.money(b.revenue), `${R.adr} ${f.money(b.sold ? Math.round(b.revenue / b.sold) : 0)}`],
    forecast: isForecast(b.end),
  }));

  const exportCsv = () => {
    if (!data) return;
    const money = (minor: number) => (minor / 100).toFixed(2);
    const head = ['date', 'rooms_available', 'rooms_sold', 'occupancy_rate', 'revenue', 'adr', 'revpar', 'forecast'];
    const rows = data.daily.map((d) =>
      [d.date, d.roomsAvailable, d.roomsSold, d.occupancyRate.toFixed(1), money(d.revenue), money(d.adr), money(d.revpar), isForecast(d.date) ? 1 : 0].join(';'),
    );
    const blob = new Blob([`﻿${[head.join(';'), ...rows].join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-${data.from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="max-w-6xl space-y-8">
      <header className="space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight">{R.title}</h1>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3" aria-label={R.period}>
          <div role="group" aria-label={R.period} className="flex flex-wrap gap-2">
            {presets.map(([label, a, b]) => (
              <button
                key={label}
                type="button"
                aria-pressed={from === a && to === b}
                onClick={() => setPeriod(a, b)}
                className={`rounded-full px-4 py-2 text-[14px] ring-1 ${from === a && to === b ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink ring-line hover:bg-paper'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="text-[13px] text-ink-soft">
            {R.from}
            <input type="date" required className={`${fieldClass} mt-0.5`} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </label>
          <label className="text-[13px] text-ink-soft">
            {R.to}
            <input type="date" required className={`${fieldClass} mt-0.5`} value={draft.to} min={draft.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </label>
          <Button type="submit" variant="secondary" disabled={!draftValid || (draft.from === from && draft.to === to)}>{R.apply}</Button>
        </form>
        {((draft.from && draft.to && !draftValid) || (from && to && !valid)) && <ErrorNote>{R.invalidRange}</ErrorNote>}
      </header>

      {report.isError ? (
        <p role="alert" className="text-maintenance">{R.loadError}</p>
      ) : !data ? (
        valid && <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />
      ) : (
        <>
          <section aria-label={R.period} className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {tiles.filter((t) => t.hero).map((t) => (
                <div key={t.label} className="rounded-lg bg-surface px-5 py-4 ring-1 ring-line">
                  <dt className="text-[13px] text-ink-soft">{t.label}</dt>
                  <dd className="mt-0.5 text-2xl leading-8 font-semibold sm:text-3xl sm:leading-10">{t.value}</dd>
                  {t.delta && <dd className="mt-0.5 text-[12px] text-ink-faint">{t.delta}</dd>}
                </div>
              ))}
            </dl>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {tiles.filter((t) => !t.hero).map((t) => (
                <div key={t.label} className="rounded-lg bg-surface px-5 py-3 ring-1 ring-line">
                  <dt className="text-[13px] text-ink-soft">{t.label}</dt>
                  <dd className="text-xl font-semibold">{t.value}</dd>
                  {t.delta && <dd className="text-[12px] text-ink-faint">{t.delta}</dd>}
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <figure className="rounded-lg bg-surface p-5 ring-1 ring-line">
              <figcaption className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{R.occupancyChart} <span className="font-normal text-ink-soft">{weekly ? R.perWeek : R.perDay}</span></span>
              </figcaption>
              <BarChart bars={occBars} max={100} gridlines={[50, 100]} formatTick={(v) => f.percent(v)} label={R.occupancyChart} />
            </figure>
            <figure className="rounded-lg bg-surface p-5 ring-1 ring-line">
              <figcaption className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{R.revenueChart} <span className="font-normal text-ink-soft">{weekly ? R.perWeek : R.perDay}</span></span>
              </figcaption>
              <BarChart bars={revBars} max={revMax} gridlines={[revMax / 2, revMax]} formatTick={(v) => f.money(v)} label={R.revenueChart} />
            </figure>
          </div>
          {buckets.some((b) => isForecast(b.end)) && (
            <p className="-mt-4 flex items-center gap-2 text-[13px] text-ink-faint">
              <span className="forecast inline-block size-3 rounded-[3px]" aria-hidden />
              {R.forecastLegend}
            </p>
          )}

          <section aria-labelledby="details-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="details-title" className="text-lg font-semibold">{R.details}</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" aria-expanded={showTable} onClick={() => setShowTable(!showTable)}>
                  {showTable ? R.hideTable : R.showTable}
                </Button>
                <Button variant="secondary" onClick={exportCsv}>
                  <Download className="size-4" aria-hidden />
                  {R.exportCsv}
                </Button>
              </div>
            </div>
            {showTable && (
              <div className="max-h-[32rem] overflow-auto rounded-lg bg-surface ring-1 ring-line">
                <table className="w-full min-w-[640px]">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-line text-[13px] text-ink-faint">
                      <th scope="col" className="px-4 py-2.5 text-start font-normal">{R.date}</th>
                      <th scope="col" className="px-3 py-2.5 text-end font-normal">{R.roomsSold}</th>
                      <th scope="col" className="px-3 py-2.5 text-end font-normal">{R.roomsAvailable}</th>
                      <th scope="col" className="px-3 py-2.5 text-end font-normal">{R.occupancy}</th>
                      <th scope="col" className="px-3 py-2.5 text-end font-normal">{R.revenue}</th>
                      <th scope="col" className="px-3 py-2.5 text-end font-normal">{R.adr}</th>
                      <th scope="col" className="px-4 py-2.5 text-end font-normal">{R.revpar}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((d) => (
                      <tr key={d.date} className="border-b border-line last:border-0">
                        <td className="px-4 py-2">
                          {fmt.shortDate(d.date)}
                          {isForecast(d.date) && <span className="ms-2 text-[12px] text-ink-faint">{R.forecast}</span>}
                        </td>
                        <td className="px-3 py-2 text-end">{d.roomsSold}</td>
                        <td className="px-3 py-2 text-end">{d.roomsAvailable}</td>
                        <td className="px-3 py-2 text-end">{f.percent(d.occupancyRate)}</td>
                        <td className="px-3 py-2 text-end">{f.amount(d.revenue)}</td>
                        <td className="px-3 py-2 text-end">{f.amount(d.adr)}</td>
                        <td className="px-4 py-2 text-end">{f.amount(d.revpar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="rounded-lg bg-surface px-5 py-4 text-[14px] ring-1 ring-line">
            <summary className="cursor-pointer font-medium">{R.methodTitle}</summary>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-ink-soft">
              {R.method.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-line/40" />}>
      <Reports />
    </Suspense>
  );
}
