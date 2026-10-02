'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, LogOut, Sparkles, Wrench } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { STATUS_STYLE, TRANSITIONS } from '@/components/dashboard/RoomBoard';
import { Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { HOUSEKEEPING } from '@/lib/i18n-housekeeping';
import { useI18n } from '@/lib/lang-context';
import type { Dashboard, Page, Room, RoomStatus, RoomType } from '@/lib/types';
import { useMe } from '../shell';

/** Même rythme que le tableau de bord : l'écran reste ouvert sur le téléphone de l'équipe. */
const REFRESH_MS = 30_000;
const UNDO_MS = 8_000;

const byFloorAndNumber = (a: Room, b: Room) => (a.floor ?? 0) - (b.floor ?? 0) || a.number.localeCompare(b.number, undefined, { numeric: true });

interface LastChange {
  room: Room;
  from: RoomStatus;
}

function Housekeeping() {
  const { lang, f } = useI18n();
  const h = HOUSEKEEPING[lang];
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const floorParam = params.get('floor');
  const floor = floorParam === null ? null : Number(floorParam);
  const [showReady, setShowReady] = useState(false);
  const [last, setLast] = useState<LastChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = useMe();
  const canChange = !!me.data?.permissions.includes('rooms:status');

  const dashboard = useQuery({
    queryKey: ['dashboard', lang],
    queryFn: async () => (await api<Dashboard>('/dashboard')).data,
    refetchInterval: REFRESH_MS,
  });
  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api<Page<Room>>('/rooms?limit=200')).data.data,
    refetchInterval: REFRESH_MS,
  });
  const roomTypes = useQuery({
    queryKey: ['room-types'],
    queryFn: async () => (await api<Page<RoomType>>('/room-types')).data.data,
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    if (!last) return;
    const id = setTimeout(() => setLast(null), UNDO_MS);
    return () => clearTimeout(id);
  }, [last]);

  const change = useMutation({
    mutationFn: ({ room, status }: { room: Room; status: RoomStatus; undo?: boolean }) =>
      api<Room>(`/rooms/${room.id}/status`, { method: 'PATCH', json: { status }, headers: { 'If-Match': `"${room.version}"` } }),
    onSuccess: ({ data }, { room, undo }) => {
      setError(null);
      qc.setQueryData<Room[]>(['rooms'], (list) => list?.map((r) => (r.id === data.id ? data : r)));
      setLast(undo ? null : { room: data, from: room.status });
    },
    onError: (e) => {
      setLast(null);
      setError(e instanceof ApiError && e.status === 412 ? h.conflict : e instanceof ApiError ? e.message : String(e));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  if (dashboard.isError || rooms.isError) {
    return (
      <div className="max-w-md py-16">
        <p role="alert" className="text-[17px]">{h.loadError}</p>
        <Button className="mt-4" onClick={() => { dashboard.refetch(); rooms.refetch(); }}>{h.retry}</Button>
      </div>
    );
  }
  if (!dashboard.data || !rooms.data) return <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />;

  const typeCode = new Map((roomTypes.data ?? []).map((rt) => [rt.id, rt.code]));
  const departing = new Set(dashboard.data.rooms?.departingToday ?? []);
  const all = [...rooms.data].sort(byFloorAndNumber);
  const floors = [...new Set(all.map((r) => r.floor ?? 0))].sort((a, b) => a - b);

  // Chambres à préparer en priorité : arrivées du jour qui n'ont pas encore de chambre prête de leur type.
  const needs = (dashboard.data.rooms?.byType ?? [])
    .map((bt) => ({ code: bt.code, need: bt.arrivalsPending - bt.available }))
    .filter((n) => n.need > 0);
  const priorityIds = new Set<string>();
  for (const { code, need } of needs) {
    all.filter((r) => r.status === 'cleaning' && typeCode.get(r.roomTypeId) === code).slice(0, need).forEach((r) => priorityIds.add(r.id));
  }

  const visible = all.filter((r) => floor === null || (r.floor ?? 0) === floor);
  const toClean = visible.filter((r) => r.status === 'cleaning').sort((a, b) => Number(priorityIds.has(b.id)) - Number(priorityIds.has(a.id)));
  const leaving = visible.filter((r) => r.status === 'occupied' && departing.has(r.number));
  const outOfOrder = visible.filter((r) => r.status === 'maintenance');
  const ready = visible.filter((r) => r.status === 'available');
  const occupiedCount = visible.filter((r) => r.status === 'occupied').length;

  const setFloor = (v: number | null) => {
    const next = new URLSearchParams(params);
    if (v === null) next.delete('floor');
    else next.set('floor', String(v));
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  const busy = change.isPending;
  const act = (room: Room, status: RoomStatus) => change.mutate({ room, status });
  const canUndo = last && TRANSITIONS[last.room.status].includes(last.from);

  const card = (room: Room, actions: React.ReactNode, note?: React.ReactNode) => (
    <li key={room.id} className="flex flex-col gap-3 rounded-lg bg-surface p-4 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <span className={`flex h-12 w-14 shrink-0 flex-col justify-center rounded-md px-2 ${STATUS_STYLE[room.status]}`} aria-hidden>
          <span className="text-[17px] leading-5 font-semibold">{room.number}</span>
          <span className="text-[11px] leading-4 opacity-80">{typeCode.get(room.roomTypeId)}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{h.room(room.number)}</h3>
          <p className="text-[13px] text-ink-faint">
            {typeCode.get(room.roomTypeId)}
            {room.floor !== null && ` · ${h.floor(room.floor)}`}
          </p>
        </div>
        {priorityIds.has(room.id) && (
          <span className="rounded-full bg-brass-soft px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap text-brass">{h.priority}</span>
        )}
      </div>
      {note}
      {actions && canChange && <div className="flex flex-wrap gap-2">{actions}</div>}
    </li>
  );

  const counts: [string, number, RoomStatus | null][] = [
    [h.toClean, toClean.length, 'cleaning'],
    [h.departing, leaving.length, null],
    [h.outOfOrder, outOfOrder.length, 'maintenance'],
    [h.ready, ready.length, 'available'],
    [h.occupied, occupiedCount, 'occupied'],
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{h.title}</h1>
          <p className="mt-1 text-ink-soft first-letter:uppercase">{f.longDate(dashboard.data.date)}</p>
        </div>
        <p className="text-[13px] text-ink-faint">
          {h.updatedAt} {f.time(new Date(Math.max(dashboard.dataUpdatedAt, rooms.dataUpdatedAt)))}
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {counts.map(([label, n, status]) => (
          <li key={label} className="rounded-lg bg-surface px-4 py-3 ring-1 ring-line">
            <span className="flex items-center gap-1.5 text-[13px] text-ink-soft">
              {status ? (
                <span className={`inline-block size-3 rounded-[3px] ${STATUS_STYLE[status]}`} aria-hidden />
              ) : (
                <span className="inline-block size-2.5 rounded-full border-2 border-brass bg-white" aria-hidden />
              )}
              {label}
            </span>
            <span className="text-2xl font-semibold">{n}</span>
          </li>
        ))}
      </ul>

      {needs.length > 0 && (
        <section aria-labelledby="priority-title" className="rounded-lg bg-brass-soft px-5 py-4">
          <h2 id="priority-title" className="font-semibold">{h.priorityTitle}</h2>
          <ul className="mt-1 list-disc ps-5">
            {needs.map((n) => <li key={n.code}>{h.priorityLine(n.need, n.code)}</li>)}
          </ul>
        </section>
      )}

      {floors.length > 1 && (
        <div role="group" aria-label={h.floorFilter} className="flex flex-wrap gap-2">
          {[null, ...floors].map((fl) => (
            <button
              key={fl ?? 'all'}
              type="button"
              aria-pressed={floor === fl}
              onClick={() => setFloor(fl)}
              className={`rounded-full px-4 py-2 text-[14px] ring-1 ${floor === fl ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink ring-line hover:bg-paper'}`}
            >
              {fl === null ? h.allFloors : h.floor(fl)}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="rounded-md bg-maintenance/10 px-3 py-2 text-maintenance">{error}</p>}

      <section aria-labelledby="clean-title" className="space-y-3">
        <h2 id="clean-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Sparkles className="size-5 text-cleaning" aria-hidden />
          {h.toClean}
        </h2>
        {toClean.length === 0 ? (
          <p className="rounded-lg bg-surface px-5 py-4 text-ink-soft ring-1 ring-line">{h.nothingToClean}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {toClean.map((room) =>
              card(
                room,
                <>
                  <Button className="min-h-11 flex-1" disabled={busy} onClick={() => act(room, 'available')}>
                    <Check className="size-4" aria-hidden />
                    {h.markClean}
                  </Button>
                  <Button variant="secondary" className="min-h-11" disabled={busy} onClick={() => act(room, 'maintenance')} aria-label={`${h.reportIssue}, ${h.room(room.number)}`} title={h.reportIssue}>
                    <Wrench className="size-4" aria-hidden />
                  </Button>
                </>,
              ),
            )}
          </ul>
        )}
      </section>

      <section aria-labelledby="leaving-title" className="space-y-3">
        <h2 id="leaving-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <LogOut className="size-5 text-brass" aria-hidden />
          {h.departing}
        </h2>
        {leaving.length === 0 ? (
          <p className="rounded-lg bg-surface px-5 py-4 text-ink-soft ring-1 ring-line">{h.noDepartures}</p>
        ) : (
          <>
            <p className="text-[14px] text-ink-soft">{h.departingHelp}</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{leaving.map((room) => card(room, null))}</ul>
          </>
        )}
      </section>

      <section aria-labelledby="ooo-title" className="space-y-3">
        <h2 id="ooo-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Wrench className="size-5 text-maintenance" aria-hidden />
          {h.outOfOrder}
        </h2>
        {outOfOrder.length === 0 ? (
          <p className="rounded-lg bg-surface px-5 py-4 text-ink-soft ring-1 ring-line">{h.noOutOfOrder}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {outOfOrder.map((room) =>
              card(
                room,
                <>
                  <Button className="min-h-11 flex-1" disabled={busy} onClick={() => act(room, 'available')}>{h.backInService}</Button>
                  <Button variant="secondary" className="min-h-11 flex-1" disabled={busy} onClick={() => act(room, 'cleaning')}>{h.needsCleaning}</Button>
                </>,
              ),
            )}
          </ul>
        )}
      </section>

      <section aria-labelledby="ready-title" className="space-y-3">
        <h2 id="ready-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Check className="size-5 text-available" aria-hidden />
          {h.ready}
        </h2>
        {ready.length === 0 ? (
          <p className="rounded-lg bg-surface px-5 py-4 text-ink-soft ring-1 ring-line">{h.noReady}</p>
        ) : (
          <>
            <Button variant="secondary" aria-expanded={showReady} onClick={() => setShowReady(!showReady)}>
              {showReady ? h.hideReady : h.showReady(ready.length)}
            </Button>
            {showReady && (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ready.map((room) =>
                  card(
                    room,
                    <>
                      <Button variant="secondary" className="min-h-11 flex-1" disabled={busy} onClick={() => act(room, 'cleaning')}>{h.needsCleaning}</Button>
                      <Button variant="secondary" className="min-h-11 flex-1" disabled={busy} onClick={() => act(room, 'maintenance')}>{h.reportIssue}</Button>
                    </>,
                  ),
                )}
              </ul>
            )}
          </>
        )}
      </section>

      {last && (
        <div role="status" className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-md items-center justify-between gap-4 rounded-lg bg-ink px-4 py-3 text-white shadow-lg">
          <span>{h.done[last.room.status](last.room.number)}</span>
          {canUndo && (
            <button
              type="button"
              disabled={busy}
              onClick={() => change.mutate({ room: last.room, status: last.from, undo: true })}
              className="font-medium text-brass-soft underline underline-offset-4 disabled:opacity-60"
            >
              {h.undo}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function HousekeepingPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-line/40" />}>
      <Housekeeping />
    </Suspense>
  );
}
