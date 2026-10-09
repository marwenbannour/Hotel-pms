'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { ChannelChart } from '@/components/dashboard/ChannelChart';
import { AlertsBell, ExportMovements } from '@/components/dashboard/HeaderActions';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { MovementsTabs } from '@/components/dashboard/MovementsTabs';
import { OccupancyDonut } from '@/components/dashboard/OccupancyDonut';
import { Performance } from '@/components/dashboard/Performance';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { ReservationSearch } from '@/components/dashboard/ReservationSearch';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { RoomBoard } from '@/components/dashboard/RoomBoard';
import { TodayPanel } from '@/components/dashboard/TodayPanel';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/lang-context';
import { useRefreshInterval } from '@/lib/live';
import type { Dashboard, Page, Room, RoomType } from '@/lib/types';
import { useAllowedPaths, useMe } from './shell';

/**
 * Actualisation de secours, quand le flux des modifications est coupé : l'écran reste ouvert
 * toute la journée à la réception.
 */
const REFRESH_MS = 30_000;

export default function DashboardPage() {
  const { lang, t, f } = useI18n();
  const me = useMe();
  const allowed = useAllowedPaths();
  const refetchInterval = useRefreshInterval(REFRESH_MS);
  const can = (p: string) => !!me.data?.permissions.includes(p);

  const dashboard = useQuery({
    queryKey: ['dashboard', lang],
    queryFn: async () => (await api<Dashboard>('/dashboard')).data,
    refetchInterval,
  });
  const showRooms = !!dashboard.data?.sections.includes('rooms');
  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api<Page<Room>>('/rooms?limit=200')).data.data,
    enabled: showRooms,
    refetchInterval,
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
  const departing = new Set(d.rooms?.departingToday ?? []);
  const hasRevenue = !!d.kpis?.trend?.length;
  const canReservations = can('reservations:read');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-9 font-semibold tracking-tight">{t.dashboardTitle}</h1>
          <p className="text-ink-soft">{t.overview}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink-soft max-sm:w-full">
          {canReservations && <ReservationSearch />}
          <span className="flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2 text-[14px] font-medium text-ink ring-1 ring-line">
            <CalendarDays className="size-4 text-ink-soft" aria-hidden />
            <span className="first-letter:uppercase">{f.longDate(d.date)}</span>
          </span>
          <span aria-live="polite">
            {dashboard.isFetching ? t.refreshing : `${t.lastUpdate} ${f.time(new Date(dashboard.dataUpdatedAt))}`}
          </span>
          <button
            onClick={() => {
              dashboard.refetch();
              rooms.refetch();
            }}
            aria-label={t.refresh}
            className="rounded-xl bg-surface p-2.5 ring-1 ring-line hover:bg-paper"
          >
            <RefreshCw className={`size-4 ${dashboard.isFetching ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          {d.alerts && <AlertsBell alerts={d.alerts} />}
          <ExportMovements data={d} />
        </div>
      </header>

      <KpiCards data={d} />

      <div className="grid items-stretch gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {d.rooms && <OccupancyDonut rooms={d.rooms} allowed={allowed} />}
        {hasRevenue && <RevenueChart data={d} allowed={allowed} />}
        {d.movements && (
          <div className={`grid ${hasRevenue ? 'lg:col-span-2 xl:col-span-1' : 'xl:col-span-2'}`}>
            <MovementsTabs
              arrivals={d.movements.arrivals}
              departures={d.movements.departures}
              canOperate={can('frontdesk:operate')}
              allowed={allowed}
            />
          </div>
        )}
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        {showRooms && rooms.data && roomTypes.data && (
          <div className={`grid min-w-0 ${d.alerts ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
            <RoomBoard
              rooms={rooms.data}
              roomTypes={roomTypes.data}
              counts={d.rooms}
              departingRoomNumbers={departing}
              canChangeStatus={can('rooms:status')}
              allowed={allowed}
            />
          </div>
        )}
        {d.alerts && <TodayPanel data={d} />}
      </div>

      {canReservations && (
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <ChannelChart date={d.date} allowed={allowed} />
          <RecentActivity timeZone={me.data?.hotel.timezone} allowed={allowed} />
        </div>
      )}

      {d.kpis?.trend && <Performance data={d} />}
    </div>
  );
}
