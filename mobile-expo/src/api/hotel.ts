import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../i18n';
import { api, ApiError, errorMessage } from './client';
import { useRefreshInterval } from './live';
import type { Dashboard, Movement, Page, Room, RoomStatus, RoomType } from './types';

/** Transitions d'état proposées pour une chambre, comme le web (RoomBoard). */
export const TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  available: ['cleaning', 'maintenance'],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning'],
  occupied: ['maintenance'],
};

/** Secours si le flux en direct est coupé : l'écran reste ouvert toute la journée. */
const REFRESH_MS = 30_000;

export function useDashboard(date?: string) {
  const { lang } = useI18n();
  const refetchInterval = useRefreshInterval(REFRESH_MS);
  return useQuery({
    queryKey: date ? ['dashboard', lang, 'day', date] : ['dashboard', lang],
    queryFn: async () => (await api<Dashboard>(date ? `/dashboard?date=${date}` : '/dashboard')).data,
    refetchInterval,
  });
}

export function useRooms(enabled = true) {
  const refetchInterval = useRefreshInterval(REFRESH_MS);
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api<Page<Room>>('/rooms?limit=200')).data.data,
    refetchInterval,
    enabled,
  });
}

export function useRoomTypes(enabled = true) {
  return useQuery({
    queryKey: ['room-types'],
    queryFn: async () => (await api<Page<RoomType>>('/room-types')).data.data,
    staleTime: 10 * 60_000,
    enabled,
  });
}

/** Code du type (SGL, DBL…) de chaque chambre. */
export function useTypeCodes() {
  const types = useRoomTypes();
  return new Map((types.data ?? []).map((t) => [t.id, t.code]));
}

/**
 * Changement d'état d'une chambre, avec contrôle de version (If-Match) : si quelqu'un l'a
 * modifiée entre-temps, l'API refuse (412) et la liste se recharge.
 */
export function useRoomStatus(onDone?: (room: Room, from: RoomStatus, undo: boolean) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ room, status }: { room: Room; status: RoomStatus; undo?: boolean }) =>
      api<Room>(`/rooms/${room.id}/status`, { method: 'PATCH', json: { status }, headers: { 'If-Match': `"${room.version}"` } }),
    onSuccess: ({ data }, { room, undo }) => {
      qc.setQueryData<Room[]>(['rooms'], (list) => list?.map((r) => (r.id === data.id ? data : r)));
      onDone?.(data, room.status, !!undo);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Message d'une erreur de changement d'état : conflit de version expliqué, sinon celui de l'API. */
export const roomErrorMessage = (e: unknown, conflict: string) => (e instanceof ApiError && e.status === 412 ? conflict : errorMessage(e));

/** Arrivée ou départ d'un séjour (le départ peut être refusé pour solde dû : 409). */
export function useStayAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'check-in' | 'check-out' }) => api(`/reservations/${id}/${action}`, { method: 'POST', json: {} }),
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['folio', id] });
    },
  });
}

/** Mouvement du jour qui attend une action : arrivée confirmée, départ d'un client présent. */
export const isActionable = (kind: 'arrivals' | 'departures', m: Pick<Movement, 'status'>) =>
  kind === 'arrivals' ? m.status === 'confirmed' : m.status === 'checked_in';
