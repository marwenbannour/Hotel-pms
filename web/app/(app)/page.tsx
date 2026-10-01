'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Movements } from '@/components/dashboard/Movements';
import { Performance } from '@/components/dashboard/Performance';
import { RoomBoard } from '@/components/dashboard/RoomBoard';
import { TodayPanel } from '@/components/dashboard/TodayPanel';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/lang-context';
import type { Dashboard, Page, Room, RoomType } from '@/lib/types';
import { useMe } from './shell';

/** Actualisation automatique : l'écran reste ouvert toute la journée à la réception. */
const REFRESH_MS = 30_000;

export default function DashboardPage() {
  const { lang, t, f } = useI18n();
  const me = useMe();
  const can = (p: string) => !!me.data?.permissions.includes(p);

  const dashboard = useQuery({
    queryKey: ['dashboard', lang],
    queryFn: async () => (await api<Dashboard>('/dashboard')).data,
    refetchInterval: REFRESH_MS,
  });
  const showRooms = !!dashboard.data?.sections.includes('rooms');
  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api<Page<Room>>('/rooms?limit=200')).data.data,
    enabled: showRooms,
    refetchInterval: REFRESH_MS,
  });
  const roomTypes = useQuery({
    queryKey: ['room-types'],
    queryFn: async () => (await api<Page<RoomType>>('/room-types')).data.data,
    enabled: showRooms,
    staleTime: 10 * 60_000,
  });

  if (dashboard.isError) {
    return (
      <div className="max-w-md py-16">
        <p role="alert" className="text-[17px]">{t.loadError}</p>
        <button onClick={() => dashboard.refetch()} className="mt-4 rounded-md bg-ink px-4 py-2 font-medium text-white">
          {t.retry}
        </button>
      </div>
    );
  }
  if (!dashboard.data) return <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />;

  const d = dashboard.data;
  const title = f.longDate(d.date);
  const departing = new Set(d.rooms?.departingToday ?? []);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight first-letter:uppercase sm:text-[2.5rem] sm:leading-[3rem]">{title}</h1>
        <div className="flex items-center gap-3 text-[13px] text-ink-soft">
          <span aria-live="polite">
            {dashboard.isFetching ? t.refreshing : `${t.lastUpdate} ${f.time(new Date(dashboard.dataUpdatedAt))}`}
          </span>
          <button
            onClick={() => {
              dashboard.refetch();
              rooms.refetch();
            }}
            aria-label={t.refresh}
            className="rounded-md p-2 ring-1 ring-line hover:bg-surface"
          >
            <RefreshCw className={`size-4 ${dashboard.isFetching ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
      </header>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        {showRooms && rooms.data && roomTypes.data && (
          <RoomBoard
            rooms={rooms.data}
            roomTypes={roomTypes.data}
            counts={d.rooms}
            departingRoomNumbers={departing}
            canChangeStatus={can('rooms:status')}
          />
        )}
        {(d.alerts || d.movements) && (
          <div className="max-xl:order-first">
            <TodayPanel data={d} />
          </div>
        )}
      </div>

      {d.movements && (
        <div className="grid gap-8 lg:grid-cols-2">
          <Movements kind="arrivals" rows={d.movements.arrivals} canOperate={can('frontdesk:operate')} />
          <Movements kind="departures" rows={d.movements.departures} canOperate={can('frontdesk:operate')} />
        </div>
      )}

      {d.kpis?.trend && <Performance data={d} />}
    </div>
  );
}
