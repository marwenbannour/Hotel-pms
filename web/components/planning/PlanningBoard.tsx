'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { STATUS_STYLE } from '@/components/dashboard/RoomBoard';
import { api, ApiError } from '@/lib/api';
import { addDays, nightsBetween } from '@/lib/dates';
import { PLANNING } from '@/lib/i18n-planning';
import { useI18n } from '@/lib/lang-context';
import type { PlanningData, PlanningStay } from '@/lib/types';
import { barColumns, packLanes, roomIsFree } from './layout';

const BAR_STYLE: Record<string, string> = {
  confirmed: 'bg-surface text-ink ring-1 ring-inset ring-ink/70',
  unassigned: 'bg-brass-soft text-ink ring-1 ring-inset ring-brass border-dashed',
  checked_in: 'bg-ink text-white',
  checked_out: 'bg-line text-ink-soft',
  overdue: 'bg-ink text-white ring-2 ring-inset ring-maintenance',
};
const styleKey = (s: PlanningStay) =>
  s.overdue ? 'overdue' : s.status === 'confirmed' && !s.roomId ? 'unassigned' : s.status;

interface Popover {
  stay: PlanningStay;
  top: number;
  left: number;
}

export function PlanningBoard({ data }: { data: PlanningData }) {
  const { lang, t, f } = useI18n();
  const p = PLANNING[lang];
  const qc = useQueryClient();
  const days = nightsBetween(data.from, data.to);
  const dates = Array.from({ length: days }, (_, i) => addDays(data.from, i));
  const [dragging, setDragging] = useState<PlanningStay | null>(null);
  const [overRow, setOverRow] = useState<string | null>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const assign = useMutation({
    mutationFn: ({ stay, roomId }: { stay: PlanningStay; roomId: string | null }) =>
      api(`/reservations/${stay.id}/room`, { method: 'PUT', json: { roomId }, headers: { 'If-Match': `"${stay.version}"` } }),
    onSuccess: (_r, { stay, roomId }) => {
      const room = data.rooms.find((r) => r.id === roomId);
      setMessage({ kind: 'ok', text: room ? p.assigned(stay.reference, room.number) : p.unassignedDone(stay.reference) });
    },
    onError: (e) => setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : String(e) }),
    onSettled: () => {
      setPopover(null);
      qc.invalidateQueries({ queryKey: ['planning'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  useEffect(() => {
    if (!popover) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !popRef.current?.contains(e.target as Node)) setPopover(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [popover]);

  const canDropOn = (roomId: string | null, roomTypeId: string) =>
    !!dragging &&
    dragging.roomTypeId === roomTypeId &&
    dragging.roomId !== roomId &&
    (roomId === null || roomIsFree(roomId, dragging, data.stays, data.today));

  const dropProps = (rowKey: string, roomId: string | null, roomTypeId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canDropOn(roomId, roomTypeId)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overRow !== rowKey) setOverRow(rowKey);
    },
    onDragLeave: () => setOverRow((r) => (r === rowKey ? null : r)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOverRow(null);
      if (dragging && canDropOn(roomId, roomTypeId)) assign.mutate({ stay: dragging, roomId });
      setDragging(null);
    },
  });

  const cols = { gridTemplateColumns: `repeat(${days * 2}, minmax(0, 1fr))` };

  /** Fond d'une ligne : une cellule par jour, aujourd'hui et week-ends repérés. */
  const dayCells = dates.map((d, i) => {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    return (
      <div
        key={d}
        aria-hidden
        className={`border-s border-line/70 ${d === data.today ? 'bg-brass-soft/60' : weekend ? 'bg-paper/70' : ''}`}
        // Placement explicite : sans lui, la grille repousse les cases derrière les barres.
        style={{ gridColumn: `${i * 2 + 1} / span 2`, gridRow: 1 }}
      />
    );
  });

  const bar = (s: PlanningStay) => {
    const [c1, c2, clipStart, clipEnd] = barColumns(s, data.from, days, data.today);
    if (c2 <= c1) return null;
    const draggable = s.status === 'confirmed';
    const nights = nightsBetween(s.arrivalDate, s.departureDate);
    const label = `${s.guestName}, ${s.reference}, ${f.shortDate(s.arrivalDate)} – ${f.shortDate(s.departureDate)}, ${p.nights(nights)}`;
    return (
      <button
        key={s.id}
        type="button"
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', s.id);
          e.dataTransfer.effectAllowed = 'move';
          setDragging(s);
          setPopover(null);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOverRow(null);
        }}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const width = 288;
          const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
          setPopover({ stay: s, top: rect.bottom + 6, left });
        }}
        aria-label={label}
        title={label}
        className={`relative z-[1] mx-px flex h-9 min-w-0 items-center self-center overflow-hidden px-2 text-start text-[13px] leading-4 font-medium ${
          BAR_STYLE[styleKey(s)]
        } ${clipStart ? '' : 'rounded-s-md'} ${clipEnd ? '' : 'rounded-e-md'} ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
          dragging?.id === s.id ? 'opacity-40' : ''
        }`}
        style={{ gridColumn: `${c1} / ${c2}`, gridRow: 1 }}
      >
        {/* dir="auto" : un nom latin dans l'interface arabe se lit et se tronque dans son propre sens. */}
        <span dir="auto" className="w-full truncate text-start">{s.guestName}</span>
      </button>
    );
  };

  const row = (key: string, label: React.ReactNode, stays: PlanningStay[], roomId: string | null, roomTypeId: string, muted = false) => {
    const droppable = canDropOn(roomId, roomTypeId);
    return (
      <div key={key} role="row" className={`grid grid-cols-[8.5rem_minmax(0,1fr)] border-b border-line ${muted ? 'bg-paper/40' : ''}`}>
        <div role="rowheader" className="sticky start-0 z-[2] flex items-center gap-2 border-e border-line bg-surface px-3 py-1.5">
          {label}
        </div>
        <div
          role="gridcell"
          {...dropProps(key, roomId, roomTypeId)}
          className={`grid min-h-12 transition-colors ${overRow === key ? 'bg-available/15 outline-2 -outline-offset-2 outline-available' : ''} ${
            dragging && !droppable && dragging.roomTypeId === roomTypeId && overRow !== key ? 'opacity-60' : ''
          }`}
          style={cols}
        >
          {dayCells}
          {stays.map(bar)}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div aria-live="polite" className="min-h-6">
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-[14px] ${message.kind === 'error' ? 'text-maintenance' : 'text-available'}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="mt-2 overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
        <div role="grid" aria-label={p.title} className="min-w-[60rem]">
          {/* En-tête des jours */}
          <div role="row" className="sticky top-0 z-[3] grid grid-cols-[8.5rem_minmax(0,1fr)] border-b border-line bg-surface">
            <div className="sticky start-0 z-[4] border-e border-line bg-surface" />
            <div className="grid" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
              {dates.map((d) => {
                const isToday = d === data.today;
                return (
                  <div
                    role="columnheader"
                    key={d}
                    aria-current={isToday ? 'date' : undefined}
                    className={`border-s border-line/70 py-2 text-center leading-4 ${isToday ? 'bg-brass-soft font-semibold text-ink' : 'text-ink-soft'}`}
                  >
                    <span className="block text-[11px]">{f.weekdayShort(d)}</span>
                    <span className="block text-[15px] font-medium">{f.dayOfMonth(d)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {data.roomTypes.map((type) => {
            const typeRooms = data.rooms.filter((r) => r.roomTypeId === type.id);
            const typeStays = data.stays.filter((s) => s.roomTypeId === type.id);
            const lanes = packLanes(typeStays.filter((s) => !s.roomId), data.today);
            return (
              <Fragment key={type.id}>
                <div role="row" className="sticky start-0 border-b border-line bg-paper px-3 py-2">
                  <span role="rowheader" className="font-semibold">
                    <bdi>{type.name}</bdi>{' '}
                    <span className="font-normal text-ink-soft">
                      <bdi>{type.code}</bdi>
                      {lang === 'ar' ? '، ' : ', '}
                      {p.roomsCount(typeRooms.length)}
                    </span>
                  </span>
                </div>
                {(lanes.length > 0 || (dragging?.roomTypeId === type.id && dragging.roomId)) &&
                  (lanes.length ? lanes : [[]]).map((lane, i) =>
                    row(
                      `${type.id}-lane-${i}`,
                      <span className="text-[13px] leading-4 text-brass">{i === 0 ? p.unassigned : ''}</span>,
                      lane,
                      null,
                      type.id,
                      true,
                    ),
                  )}
                {typeRooms.map((room) =>
                  row(
                    room.id,
                    <>
                      <span className={`size-3 shrink-0 rounded-[3px] ${STATUS_STYLE[room.status]}`} title={t.statuses[room.status]} aria-hidden />
                      <span className="font-semibold">{room.number}</span>
                      <span className="sr-only">{t.statuses[room.status]}</span>
                    </>,
                    typeStays.filter((s) => s.roomId === room.id),
                    room.id,
                    type.id,
                  ),
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {popover && (
        <div
          ref={popRef}
          role="dialog"
          aria-label={popover.stay.guestName}
          className="fixed z-50 w-72 rounded-lg bg-surface p-4 shadow-xl ring-1 ring-line"
          style={{ top: Math.min(popover.top, window.innerHeight - 260), left: popover.left }}
        >
          <StayPopover
            stay={popover.stay}
            data={data}
            busy={assign.isPending}
            onAssign={(roomId) => assign.mutate({ stay: popover.stay, roomId })}
            onClose={() => setPopover(null)}
          />
        </div>
      )}
    </div>
  );
}

function StayPopover({
  stay, data, busy, onAssign, onClose,
}: { stay: PlanningStay; data: PlanningData; busy: boolean; onAssign: (roomId: string | null) => void; onClose: () => void }) {
  const { lang, f } = useI18n();
  const p = PLANNING[lang];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const rooms = data.rooms.filter((r) => r.roomTypeId === stay.roomTypeId);
  const nights = nightsBetween(stay.arrivalDate, stay.departureDate);

  return (
    <div className="space-y-3 text-[14px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold"><bdi>{stay.guestName}</bdi></p>
          <p className="text-[13px] text-ink-soft">
            <span dir="ltr">{stay.reference}</span>, {p.guests(stay.adults + stay.children)}
          </p>
        </div>
        <button ref={closeRef} onClick={onClose} className="rounded px-1 text-ink-soft hover:text-ink" aria-label={p.close}>
          ×
        </button>
      </div>
      <p>
        {f.shortDate(stay.arrivalDate)} – {f.shortDate(stay.departureDate)}, {p.nights(nights)}
      </p>
      {stay.status === 'confirmed' && (
        <label className="block">
          <span className="text-[13px] text-ink-soft">{p.assignTo}</span>
          <select
            className="mt-1 block w-full rounded-md border border-line bg-surface px-2 py-1.5"
            value={stay.roomId ?? ''}
            disabled={busy}
            onChange={(e) => onAssign(e.target.value || null)}
          >
            <option value="">{p.noRoom}</option>
            {rooms.map((r) => {
              const free = r.id === stay.roomId || roomIsFree(r.id, stay, data.stays, data.today);
              return (
                <option key={r.id} value={r.id} disabled={!free}>
                  {r.number}
                  {free ? '' : ` (${p.busy})`}
                </option>
              );
            })}
          </select>
        </label>
      )}
      <Link href={`/reservations/${stay.id}`} className="inline-block font-medium text-brass underline underline-offset-4">
        {p.open}
      </Link>
    </div>
  );
}
