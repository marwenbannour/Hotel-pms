'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useGuestsDict } from '@/components/guests/GuestForm';
import { Button, fieldClass, useDebounced } from '@/components/ui';
import { api } from '@/lib/api';
import { GUEST_SEGMENTS } from '@/lib/i18n-guests';
import type { Guest, Page } from '@/lib/types';
import { useMe } from '../shell';

function GuestList() {
  const g = useGuestsDict();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const me = useMe();
  const canWrite = !!me.data?.permissions.includes('guests:write');
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 300);
  const segment = params.get('segment') ?? '';

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

  const query = new URLSearchParams({ limit: '50', sort: 'last_name' });
  for (const k of ['q', 'segment']) {
    const v = params.get(k);
    if (v) query.set(k, v);
  }

  const list = useInfiniteQuery({
    queryKey: ['guests', 'list', query.toString()],
    queryFn: async ({ pageParam }) => (await api<Page<Guest>>(`/guests?${query}${pageParam ? `&cursor=${pageParam}` : ''}`)).data,
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const filtered = !!(params.get('q') || segment);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{g.title}</h1>
        {canWrite && (
          <Link href="/guests/new" className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 font-medium text-white hover:bg-ink/90">
            <Plus className="size-4" aria-hidden />
            {g.newGuest}
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-3" role="search">
        <label className="relative min-w-[16rem] flex-1">
          <span className="sr-only">{g.search}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            className={`${fieldClass} mt-0 ps-9`}
            placeholder={g.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">{g.segment}</span>
          <select className={`${fieldClass} mt-0`} value={segment} onChange={(e) => setParam({ segment: e.target.value })}>
            <option value="">{g.allSegments}</option>
            {GUEST_SEGMENTS.map((s) => (
              <option key={s} value={s}>{g.segments[s]}</option>
            ))}
          </select>
        </label>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setQ('');
              router.replace(pathname);
            }}
          >
            {g.clearFilters}
          </Button>
        )}
      </div>

      {list.isError ? (
        <p role="alert" className="text-maintenance">{g.loadError}</p>
      ) : list.isPending ? (
        <div className="h-64 animate-pulse rounded-lg bg-line/40" aria-busy="true" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg bg-surface px-6 py-10 ring-1 ring-line">
          <p className="font-medium">{filtered ? g.noResults : g.empty}</p>
          {filtered && <p className="mt-1 text-ink-soft">{g.noResultsHint}</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-ink-faint">
                <th scope="col" className="px-4 py-2.5 text-start font-normal">{g.name}</th>
                <th scope="col" className="px-3 py-2.5 text-start font-normal">{g.contact}</th>
                <th scope="col" className="px-3 py-2.5 text-start font-normal">{g.nationality}</th>
                <th scope="col" className="px-4 py-2.5 text-start font-normal">{g.segment}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((guest) => (
                <tr key={guest.id} className="relative border-b border-line last:border-0 hover:bg-paper/70">
                  <td className="px-4 py-3">
                    <Link href={`/guests/${guest.id}`} className="font-medium after:absolute after:inset-0 focus-visible:outline-none">
                      {guest.lastName.toUpperCase()} {guest.firstName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[14px]" dir="ltr">
                    {guest.email && <span className="block">{guest.email}</span>}
                    {guest.phone && <span className="block text-ink-soft">{guest.phone}</span>}
                    {!guest.email && !guest.phone && <span className="text-ink-faint">{g.none}</span>}
                  </td>
                  <td className="px-3 py-3">{guest.nationality ?? <span className="text-ink-faint">–</span>}</td>
                  <td className="px-4 py-3">{g.segments[guest.segment] ?? guest.segment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.hasNextPage && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {g.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function GuestsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-line/40" />}>
      <GuestList />
    </Suspense>
  );
}
