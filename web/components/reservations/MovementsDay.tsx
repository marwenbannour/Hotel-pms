'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Movements } from '@/components/dashboard/Movements';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays } from '@/lib/dates';
import { useI18n, useRes } from '@/lib/lang-context';
import type { Dashboard } from '@/lib/types';
import { useHotelToday, useMe } from '@/app/(app)/shell';

/** Arrivées ou départs d'un jour, avec navigation de jour en jour. */
export function MovementsDay({ kind }: { kind: 'arrivals' | 'departures' }) {
  const { lang, f } = useI18n();
  const r = useRes();
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = useHotelToday();
  const date = params.get('date') ?? today;
  const go = (d: string) => router.replace(d === today ? pathname : `${pathname}?date=${d}`, { scroll: false });

  const data = useQuery({
    queryKey: ['dashboard', lang, 'day', date],
    queryFn: async () => (await api<Dashboard>(`/dashboard?date=${date}`)).data,
    refetchInterval: date === today ? 30_000 : false,
  });
  const rows = data.data?.movements?.[kind] ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-ink-soft">{kind === 'arrivals' ? r.arrivalsTitle : r.departuresTitle}</p>
          <h1 className="text-3xl font-semibold tracking-tight first-letter:uppercase">{f.longDate(date)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="px-2.5" onClick={() => go(addDays(date, -1))} aria-label={r.previousDay}>
            <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
          {date !== today && <Button variant="secondary" onClick={() => go(today)}>{r.today}</Button>}
          <Button variant="secondary" className="px-2.5" onClick={() => go(addDays(date, 1))} aria-label={r.nextDay}>
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      </header>
      {date !== today && <p className="text-[14px] text-ink-soft">{r.actionsTodayOnly}</p>}
      {data.isPending ? (
        <div className="h-48 animate-pulse rounded-lg bg-line/40" aria-busy="true" />
      ) : (
        <Movements kind={kind} rows={rows} canOperate={date === today && !!me.data?.permissions.includes('frontdesk:operate')} />
      )}
    </div>
  );
}
