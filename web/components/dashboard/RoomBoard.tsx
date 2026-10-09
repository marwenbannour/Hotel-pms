'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/lang-context';
import type { Room, RoomStatus, RoomType } from '@/lib/types';
import { CARD, CardLink, CardTitle } from './card';

/** Mêmes transitions manuelles que l'API (occupée ne se libère que par le départ). */
export const TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  available: ['cleaning', 'maintenance'],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning'],
  occupied: ['maintenance'],
};

/** Couleur pleine de l'état : repères (légendes, pastilles) et petites tuiles. */
export const STATUS_STYLE: Record<RoomStatus, string> = {
  available: 'bg-available text-navy',
  occupied: 'bg-occupied text-white',
  cleaning: 'bg-cleaning text-navy',
  // Hachures en plus de la couleur : l'état reste lisible sans distinguer les couleurs.
  maintenance:
    'bg-maintenance text-white bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(255,255,255,.16)_6px_12px)]',
};

/** Tuiles de chambre (charte HOTELIA) : teinte claire et texte foncé, pleine pour occupée et maintenance. */
export const TILE_STYLE: Record<RoomStatus, string> = {
  available: 'bg-available-soft text-available-text ring-1 ring-inset ring-available/60',
  occupied: 'bg-occupied text-white',
  cleaning: 'bg-cleaning-soft text-cleaning-text ring-1 ring-inset ring-cleaning/70',
  maintenance: STATUS_STYLE.maintenance,
};

const ORDER: RoomStatus[] = ['available', 'occupied', 'cleaning', 'maintenance'];
const DOT: Record<RoomStatus, string> = {
  available: 'bg-available',
  occupied: 'bg-occupied',
  cleaning: 'bg-cleaning',
  maintenance: 'bg-maintenance',
};

interface Props {
  rooms: Room[];
  roomTypes: RoomType[];
  counts?: Record<RoomStatus, number>;
  departingRoomNumbers: Set<string>;
  canChangeStatus: boolean;
  /** Écrans accessibles au profil, pour le lien vers la liste complète. */
  allowed: Set<string>;
}

export function RoomBoard({ rooms, roomTypes, counts, departingRoomNumbers, canChangeStatus, allowed }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [floorFilter, setFloorFilter] = useState('all');
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
  const allFloors = [...floors.keys()].sort((a, b) => a - b);
  const sortedFloors = [...floors.entries()]
    .filter(([floor]) => floorFilter === 'all' || String(floor) === floorFilter)
    .sort(([a], [b]) => a - b);

  return (
    <section aria-labelledby="board-title" className={`${CARD} flex flex-col gap-4 p-5`}>
      <CardTitle
        id="board-title"
        action={
          allFloors.length > 1 && (
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              aria-label={t.floor}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-soft"
            >
              <option value="all">{t.allFloors}</option>
              {allFloors.map((fl) => (
                <option key={fl} value={String(fl)}>{t.floor} {fl}</option>
              ))}
            </select>
          )
        }
      >
        {t.roomStatus}
      </CardTitle>

      {error && <p role="alert" className="text-maintenance">{error}</p>}

      <div ref={boardRef} className="space-y-4">
        {sortedFloors.map(([floor, list]) => (
          <div key={floor}>
            <h3 className="mb-2 font-sans text-[13px] font-semibold text-ink">{t.floor} {floor}</h3>
            <ul className="flex flex-wrap gap-2">
              {list
                .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                .map((room) => {
                  const departing = departingRoomNumbers.has(room.number);
                  const label = `${t.room} ${room.number}, ${typeCode.get(room.roomTypeId) ?? ''}, ${t.statuses[room.status]}${
                    departing ? `, ${t.departingToday}` : ''
                  }`;
                  const tile = (
                    <>
                      <span className="flex items-baseline justify-between gap-1">
                        <span className="text-[15px] leading-5 font-semibold">{room.number}</span>
                        <span className="text-[10px] leading-4 opacity-75">{typeCode.get(room.roomTypeId)}</span>
                      </span>
                      <span className="block truncate text-[11px] leading-4 opacity-90">{t.statuses[room.status]}</span>
                      {departing && (
                        <span className="absolute -top-1 -end-1 size-3 rounded-full border-2 border-gold bg-white" aria-hidden />
                      )}
                    </>
                  );
                  const tileClass = `relative block h-[3.25rem] w-[6.5rem] rounded-lg px-2.5 py-1.5 text-start ${TILE_STYLE[room.status]}`;
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

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-4">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
          {ORDER.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`inline-block size-2.5 rounded-full ${DOT[s]}`} aria-hidden />
              {t.statuses[s]}
              {counts && <span className="font-medium text-ink">{counts[s]}</span>}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full border-2 border-gold bg-white" aria-hidden />
            {t.departingToday}
          </li>
        </ul>
        <CardLink href="/housekeeping" allowed={allowed}>{t.seeRooms}</CardLink>
      </div>
    </section>
  );
}
