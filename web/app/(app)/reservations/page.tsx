'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { StatusBadge } from '@/components/reservations/StatusBadge';
import { Button, fieldClass, useDebounced } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n, useRes } from '@/lib/lang-context';
import type { Page, Reservation, ReservationStatus } from '@/lib/types';

const STATUSES: ReservationStatus[] = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];

function ReservationList() {
  const { t, f } = useI18n();
  const r = useRes();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 300);
  const status = params.get('status') ?? '';
  const from = params.get('arrival_from') ?? '';
  const to = params.get('arrival_to') ?? '';

  const setParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) (v ? next.set(k, v) : next.delete(k));
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  useEffect(() => {
    const term = debouncedQ.trim();
    if ((params.get('q') ?? '') !== term && (term.length === 0 || term.length >= 2)) setParam({ q: term });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const query = new URLSearchParams({ limit: '50', sort: from || to ? 'arrival_date' : '-arrival_date' });
  for (const k of ['q', 'status', 'arrival_from', 'arrival_to']) {
    const v = params.get(k);
    if (v) query.set(k, v);
  }

  const list = useInfiniteQuery({
    queryKey: ['reservations', query.toString()],
    queryFn: async ({ pageParam }) =>
      (await api<Page<Reservation>>(`/reservations?${query}${pageParam ? `&cursor=${pageParam}` : ''}`)).data,
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const filtered = !!(params.get('q') || status || from || to);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{r.title}</h1>
        <Link href="/reservations/new" className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 font-medium text-white hover:bg-ink/90">
          <Plus className="size-4" aria-hidden />
          {r.newReservation}
        </Link>
      </header>

      <div className="flex flex-wrap items-end gap-3" role="search">
        <label className="relative min-w-[16rem] flex-1">
          <span className="sr-only">{r.search}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            className={`${fieldClass} mt-0 ps-9`}
            placeholder={r.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">{r.status}</span>
          <select className={`${fieldClass} mt-0`} value={status} onChange={(e) => setParam({ status: e.target.value })}>
            <option value="">{r.allStatuses}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{r.statuses[s]}</option>
            ))}
          </select>
        </label>
        <label className="text-[13px] text-ink-soft">
          {r.arrivalFrom}
          <input type="date" className={`${fieldClass} mt-0.5`} value={from} onChange={(e) => setParam({ arrival_from: e.target.value })} />
        </label>
        <label className="text-[13px] text-ink-soft">
          {r.arrivalTo}
          <input type="date" className={`${fieldClass} mt-0.5`} value={to} min={from} onChange={(e) => setParam({ arrival_to: e.target.value })} />
        </label>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setQ('');
              router.replace(pathname);
            }}
          >
            {r.clearFilters}
          </Button>
        )}
      </div>

      {list.isError ? (
        <p role="alert" className="text-maintenance">{t.loadError}</p>
      ) : list.isPending ? (
        <div className="h-64 animate-pulse rounded-lg bg-line/40" aria-busy="true" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg bg-surface px-6 py-10 ring-1 ring-line">
          <p className="font-medium">{r.noResults}</p>
          <p className="mt-1 text-ink-soft">{r.noResultsHint}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-ink-faint">
                <th scope="col" className="px-4 py-2.5 text-start font-normal">{t.guest}</th>
                <th scope="col" className="px-3 py-2.5 text-start font-normal">{r.stay}</th>
                <th scope="col" className="px-3 py-2.5 text-start font-normal">{t.roomType}</th>
                <th scope="col" className="px-3 py-2.5 text-start font-normal">{t.guests}</th>
                <th scope="col" className="px-3 py-2.5 text-end font-normal">{r.amount}</th>
                <th scope="col" className="px-4 py-2.5 text-start font-normal">{r.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((res) => (
                <tr key={res.id} className="relative border-b border-line last:border-0 hover:bg-paper/70">
                  <td className="px-4 py-3">
                    <Link href={`/reservations/${res.id}`} className="font-medium after:absolute after:inset-0 focus-visible:outline-none">
                      {res.guest.firstName} {res.guest.lastName}
                    </Link>
                    <span className="block text-[13px] text-ink-faint" dir="ltr">{res.reference}</span>
                  </td>
                  <td className="px-3 py-3">
                    {f.shortDate(res.arrivalDate)} – {f.shortDate(res.departureDate)}
                    <span className="block text-[13px] text-ink-faint">{r.nightsCount(res.nights)}, {t.boards[res.board]}</span>
                  </td>
                  <td className="px-3 py-3">
                    {res.roomType.code}
                    {res.room && <span className="block text-[13px] text-ink-faint">{t.room} {res.room.number}</span>}
                  </td>
                  <td className="px-3 py-3">{res.adults + res.children}</td>
                  <td className="px-3 py-3 text-end">{f.money(res.totalAmount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={res.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.hasNextPage && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {r.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-line/40" />}>
      <ReservationList />
    </Suspense>
  );
}
