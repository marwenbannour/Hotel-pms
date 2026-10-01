'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PlanningBoard } from '@/components/planning/PlanningBoard';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays } from '@/lib/dates';
import { PLANNING } from '@/lib/i18n-planning';
import { useI18n } from '@/lib/lang-context';
import type { PlanningData } from '@/lib/types';
import { useHotelToday } from '../shell';

const DAYS = 14;

function Planning() {
  const { lang, f } = useI18n();
  const p = PLANNING[lang];
  const today = useHotelToday();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Par défaut, la période commence la veille : on voit les départs du jour.
  const defaultFrom = addDays(today, -1);
  const from = params.get('from') ?? defaultFrom;
  const to = addDays(from, DAYS);
  const go = (d: string) => router.replace(d === defaultFrom ? pathname : `${pathname}?from=${d}`, { scroll: false });

  const q = useQuery({
    queryKey: ['planning', from, to],
    queryFn: async () => (await api<PlanningData>(`/planning?from=${from}&to=${to}`)).data,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

  const legend = [
    ['bg-surface ring-1 ring-inset ring-ink/70', p.legendConfirmed],
    ['bg-brass-soft ring-1 ring-inset ring-brass', p.legendUnassigned],
    ['bg-ink', p.legendInHouse],
    ['bg-ink ring-2 ring-inset ring-maintenance', p.legendOverdue],
    ['bg-line', p.legendDeparted],
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{p.title}</h1>
          <p className="mt-1 text-ink-soft">
            {f.shortDate(from)} – {f.shortDate(addDays(to, -1))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {from !== defaultFrom && <Button variant="secondary" onClick={() => go(defaultFrom)}>{p.today}</Button>}
          <Button variant="secondary" aria-label={p.previous} onClick={() => go(addDays(from, -7))}>
            <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
          <Button variant="secondary" aria-label={p.next} onClick={() => go(addDays(from, 7))}>
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[13px] text-ink-soft">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {legend.map(([cls, label]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-5 rounded-[3px] ${cls}`} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
        <p>{p.dragHint}</p>
      </div>

      {q.isError && <p role="alert" className="text-maintenance">{p.loadError}</p>}
      {q.data ? <PlanningBoard data={q.data} /> : !q.isError && <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />}
    </div>
  );
}

export default function PlanningPage() {
  return (
    <Suspense>
      <Planning />
    </Suspense>
  );
}
