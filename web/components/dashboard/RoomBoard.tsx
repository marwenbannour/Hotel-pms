'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/lang-context';
import type { Room, RoomStatus, RoomType } from '@/lib/types';

/** Mêmes transitions manuelles que l'API (occupée ne se libère que par le départ). */
const TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  available: ['cleaning', 'maintenance'],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning'],
  occupied: ['maintenance'],
};

export const STATUS_STYLE: Record<RoomStatus, string> = {
  available: 'bg-available text-white',
  occupied: 'bg-occupied text-white',
  cleaning: 'bg-cleaning text-ink',
  // Hachures en plus de la couleur : l'état reste lisible sans distinguer les couleurs.
  maintenance:
    'bg-maintenance text-white bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(255,255,255,.16)_6px_12px)]',
};

const ORDER: RoomStatus[] = ['available', 'occupied', 'cleaning', 'maintenance'];

interface Props {
  rooms: Room[];
  roomTypes: RoomType[];
  counts?: Record<RoomStatus, number>;
  departingRoomNumbers: Set<string>;
  canChangeStatus: boolean;
}

export function RoomBoard({ rooms, roomTypes, counts, departingRoomNumbers, canChangeStatus }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const typeCode = new Map(roomTypes.map((rt) => [rt.id, rt.code]));

  const change = useMutation({
    mutationFn: ({ room, status }: { room: Room; status: RoomStatus }) =>
      api<Room>(`/rooms/${room.id}/status`, { method: 'PATCH', json: { status }, headers: { 'If-Match': `"${room.version}"` } }),
    onSuccess: () => setError(null),
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
    onSettled: () => {
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  useEffect(() => {
    if (!openId) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !boardRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [openId]);

  const floors = new Map<number, Room[]>();
  for (const r of rooms) {
    const f = r.floor ?? 0;
    floors.set(f, [...(floors.get(f) ?? []), r]);
  }
  const sortedFloors = [...floors.entries()].sort(([a], [b]) => b - a);

  return (
    <section aria-labelledby="board-title">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="board-title" className="text-xl font-semibold tracking-tight">{t.roomBoard}</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
          {ORDER.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`inline-block size-3 rounded-[3px] ${STATUS_STYLE[s]}`} aria-hidden />
              {t.statuses[s]}
              {counts && <span className="font-medium text-ink">{counts[s]}</span>}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full border-2 border-brass bg-white" aria-hidden />
            {t.departingToday}
          </li>
        </ul>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-maintenance">{error}</p>
      )}

      <div ref={boardRef} className="space-y-3 rounded-lg bg-surface p-4 ring-1 ring-line sm:p-5">
        {sortedFloors.map(([floor, list]) => (
          <div key={floor} className="flex items-start gap-4">
            <div className="w-10 shrink-0 pt-3 text-center text-ink-faint" title={`${t.floor} ${floor}`}>
              <span className="text-[12px]">{t.floorShort}</span>
              <span className="block text-lg leading-5 font-medium text-ink-soft">{floor}</span>
            </div>
            <ul className="flex flex-1 flex-wrap gap-2">
              {list
                .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                .map((room) => {
                  const departing = departingRoomNumbers.has(room.number);
                  const label = `${t.room} ${room.number}, ${typeCode.get(room.roomTypeId) ?? ''}, ${t.statuses[room.status]}${
                    departing ? `, ${t.departingToday}` : ''
                  }`;
                  const tile = (
                    <>
                      <span className="block text-[17px] leading-5 font-semibold">{room.number}</span>
                      <span className="block text-[11px] leading-4 opacity-80">{typeCode.get(room.roomTypeId)}</span>
                      {departing && (
                        <span className="absolute -top-1 -end-1 size-3 rounded-full border-2 border-brass bg-white" aria-hidden />
                      )}
                    </>
                  );
                  const tileClass = `relative block h-14 w-[4.25rem] rounded-md px-2 py-1.5 text-start ${STATUS_STYLE[room.status]}`;
                  return (
                    <li key={room.id} className="relative">
                      {canChangeStatus ? (
                        <button
                          type="button"
                          className={`${tileClass} cursor-pointer hover:brightness-110`}
                          aria-label={`${label}. ${t.changeStatus}`}
                          aria-haspopup="menu"
                          aria-expanded={openId === room.id}
                          title={label}
                          onClick={() => setOpenId(openId === room.id ? null : room.id)}
                        >
                          {tile}
                        </button>
                      ) : (
                        <div className={tileClass} role="img" aria-label={label} title={label}>{tile}</div>
                      )}
                      {openId === room.id && (
                        <div role="menu" className="absolute start-0 top-full z-10 mt-1.5 w-48 rounded-md bg-surface py-1 shadow-lg ring-1 ring-line">
                          <p className="px-3 pt-1.5 pb-1 text-[12px] text-ink-faint">{t.markAs}</p>
                          {TRANSITIONS[room.status].map((s) => (
                            <button
                              key={s}
                              role="menuitem"
                              type="button"
                              disabled={change.isPending}
                              onClick={() => change.mutate({ room, status: s })}
                              className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-paper disabled:opacity-50"
                            >
                              <span className={`inline-block size-3 rounded-[3px] ${STATUS_STYLE[s]}`} aria-hidden />
                              {t.statuses[s]}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
