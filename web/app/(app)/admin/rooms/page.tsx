'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { FormEvent, Fragment, useState } from 'react';
import { STATUS_STYLE } from '@/components/dashboard/RoomBoard';
import { Button, ErrorNote, fieldClass } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatters } from '@/lib/i18n';
import { ADMIN } from '@/lib/i18n-admin';
import { useI18n } from '@/lib/lang-context';
import { splitProblem } from '@/lib/problem';
import type { Page, Room, RoomType } from '@/lib/types';
import { useMe } from '../../shell';

const cell = `${fieldClass} mt-0 py-1.5`;

interface TypeDraft { id?: string; version?: number; code: string; name: string; capacity: string; basePrice: string; currency: string }
interface RoomDraft { id?: string; version?: number; number: string; floor: string; roomTypeId: string }

/** Montant saisi en unités (95,50) → unités mineures (9550). */
const toMinor = (v: string) => Math.round(Number(v.replace(',', '.')) * 100);

export default function AdminRoomsPage() {
  const { lang, t } = useI18n();
  const a = ADMIN[lang];
  const me = useMe();
  const qc = useQueryClient();
  const canWrite = !!me.data?.permissions.includes('rooms:write');
  const [typeDraft, setTypeDraft] = useState<TypeDraft | null>(null);
  const [roomDraft, setRoomDraft] = useState<RoomDraft | null>(null);
  const [conflict, setConflict] = useState(false);

  const types = useQuery({ queryKey: ['room-types'], queryFn: async () => (await api<Page<RoomType>>('/room-types')).data.data });
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: async () => (await api<Page<Room>>('/rooms?limit=200')).data.data });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['room-types'] });
    qc.invalidateQueries({ queryKey: ['rooms'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const onError = (e: unknown, reset: () => void) => {
    if (e instanceof ApiError && e.status === 412) {
      setConflict(true);
      reset();
      refresh();
    }
  };

  const saveType = useMutation({
    mutationFn: (d: TypeDraft) => {
      const body = { code: d.code.trim().toUpperCase(), name: d.name.trim(), capacity: Number(d.capacity), basePrice: toMinor(d.basePrice), currency: d.currency.trim().toUpperCase() };
      return d.id
        ? api<RoomType>(`/room-types/${d.id}`, { method: 'PATCH', json: body, headers: { 'If-Match': `"${d.version}"` } })
        : api<RoomType>('/room-types', { method: 'POST', json: body });
    },
    onSuccess: () => { setTypeDraft(null); setConflict(false); refresh(); },
    onError: (e) => onError(e, () => setTypeDraft(null)),
  });
  const saveRoom = useMutation({
    mutationFn: (d: RoomDraft) => {
      const body = { number: d.number.trim(), floor: d.floor === '' ? undefined : Number(d.floor), roomTypeId: d.roomTypeId };
      return d.id
        ? api<Room>(`/rooms/${d.id}`, { method: 'PATCH', json: body, headers: { 'If-Match': `"${d.version}"` } })
        : api<Room>('/rooms', { method: 'POST', json: body });
    },
    onSuccess: () => { setRoomDraft(null); setConflict(false); refresh(); },
    onError: (e) => onError(e, () => setRoomDraft(null)),
  });

  if (me.data && !canWrite) return <p role="alert" className="py-16 text-[17px]">{a.forbidden}</p>;
  if (types.isError || rooms.isError) return <p role="alert" className="py-16 text-[17px]">{a.loadError}</p>;
  if (!types.data || !rooms.data) return <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />;

  const typeById = new Map(types.data.map((rt) => [rt.id, rt]));
  const countByType = new Map<string, number>();
  for (const r of rooms.data) countByType.set(r.roomTypeId, (countByType.get(r.roomTypeId) ?? 0) + 1);
  const sortedRooms = [...rooms.data].sort((x, y) => (x.floor ?? 0) - (y.floor ?? 0) || x.number.localeCompare(y.number, undefined, { numeric: true }));
  const typeErrors = splitProblem(saveType.isError && !(saveType.error instanceof ApiError && saveType.error.status === 412) ? saveType.error : null);
  const roomErrors = splitProblem(saveRoom.isError && !(saveRoom.error instanceof ApiError && saveRoom.error.status === 412) ? saveRoom.error : null);

  const editType = (rt?: RoomType) => {
    saveType.reset();
    setTypeDraft(
      rt
        ? { id: rt.id, version: rt.version, code: rt.code, name: rt.name, capacity: String(rt.capacity ?? 2), basePrice: ((rt.basePrice ?? 0) / 100).toFixed(2), currency: rt.currency ?? 'EUR' }
        : { code: '', name: '', capacity: '2', basePrice: '', currency: me.data?.hotel.currency ?? 'EUR' },
    );
  };
  const editRoom = (r?: Room) => {
    saveRoom.reset();
    setRoomDraft(r ? { id: r.id, version: r.version, number: r.number, floor: r.floor === null ? '' : String(r.floor), roomTypeId: r.roomTypeId } : { number: '', floor: '', roomTypeId: types.data[0]?.id ?? '' });
  };

  const typeForm = (d: TypeDraft) => (
    <tr className="border-b border-line bg-paper/60 last:border-0">
      <td className="px-4 py-2" colSpan={6}>
        <form
          className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)_6rem_9rem_6rem_auto] sm:items-end"
          onSubmit={(e: FormEvent) => { e.preventDefault(); saveType.mutate(d); }}
        >
          <label className="text-[13px] text-ink-soft">{a.code}
            <input className={`${cell} uppercase`} dir="ltr" required pattern="[A-Za-z0-9_\-]{1,20}" title={a.codeHint} value={d.code} onChange={(e) => setTypeDraft({ ...d, code: e.target.value })} autoFocus />
          </label>
          <label className="text-[13px] text-ink-soft">{a.name}
            <input className={cell} required maxLength={120} value={d.name} onChange={(e) => setTypeDraft({ ...d, name: e.target.value })} />
          </label>
          <label className="text-[13px] text-ink-soft">{a.capacity}
            <input className={cell} type="number" required min={1} max={20} value={d.capacity} onChange={(e) => setTypeDraft({ ...d, capacity: e.target.value })} />
          </label>
          <label className="text-[13px] text-ink-soft">{a.basePrice}
            <input className={cell} dir="ltr" inputMode="decimal" required pattern="\d+([.,]\d{1,2})?" value={d.basePrice} onChange={(e) => setTypeDraft({ ...d, basePrice: e.target.value })} />
          </label>
          <label className="text-[13px] text-ink-soft">{a.currency}
            <input className={`${cell} uppercase`} dir="ltr" required pattern="[A-Za-z]{3}" maxLength={3} value={d.currency} onChange={(e) => setTypeDraft({ ...d, currency: e.target.value })} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={saveType.isPending}>{saveType.isPending ? a.saving : a.save}</Button>
            <Button variant="ghost" onClick={() => setTypeDraft(null)}>{a.cancel}</Button>
          </div>
        </form>
        <div className="mt-2"><ErrorNote>{typeErrors.message ?? Object.values(typeErrors.fields)[0]}</ErrorNote></div>
      </td>
    </tr>
  );

  const roomForm = (d: RoomDraft) => (
    <tr className="border-b border-line bg-paper/60 last:border-0">
      <td className="px-4 py-2" colSpan={5}>
        <form
          className="grid gap-3 sm:grid-cols-[7rem_6rem_minmax(0,16rem)_auto] sm:items-end"
          onSubmit={(e: FormEvent) => { e.preventDefault(); saveRoom.mutate(d); }}
        >
          <label className="text-[13px] text-ink-soft">{a.number}
            <input className={cell} dir="ltr" required maxLength={20} value={d.number} onChange={(e) => setRoomDraft({ ...d, number: e.target.value })} autoFocus />
          </label>
          <label className="text-[13px] text-ink-soft">{a.floor}
            <input className={cell} type="number" value={d.floor} onChange={(e) => setRoomDraft({ ...d, floor: e.target.value })} />
          </label>
          <label className="text-[13px] text-ink-soft">{a.type}
            <select className={cell} required value={d.roomTypeId} onChange={(e) => setRoomDraft({ ...d, roomTypeId: e.target.value })}>
              {types.data.map((rt) => <option key={rt.id} value={rt.id}>{rt.code} – {rt.name}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={saveRoom.isPending}>{saveRoom.isPending ? a.saving : a.save}</Button>
            <Button variant="ghost" onClick={() => setRoomDraft(null)}>{a.cancel}</Button>
          </div>
        </form>
        <div className="mt-2"><ErrorNote>{roomErrors.message ?? Object.values(roomErrors.fields)[0]}</ErrorNote></div>
      </td>
    </tr>
  );

  const editButton = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label={label} title={a.edit} className="rounded p-1.5 text-ink-soft hover:bg-paper hover:text-ink">
      <Pencil className="size-4" aria-hidden />
    </button>
  );

  return (
    <div className="max-w-5xl space-y-10">
      <h1 className="text-3xl font-semibold tracking-tight">{a.roomsTitle}</h1>
      {conflict && <ErrorNote>{a.conflict}</ErrorNote>}

      <section aria-labelledby="types-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="types-title" className="text-xl font-semibold tracking-tight">{a.roomTypes}</h2>
          {typeDraft === null && (
            <Button variant="secondary" onClick={() => editType()}><Plus className="size-4" aria-hidden />{a.newRoomType}</Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-ink-faint">
                <th scope="col" className="px-4 py-2.5 text-start font-normal">{a.code}</th>
                <th scope="col" className="px-3 py-2.5 text-start font-normal">{a.name}</th>
                <th scope="col" className="px-3 py-2.5 text-start font-normal">{a.capacity}</th>
                <th scope="col" className="px-3 py-2.5 text-end font-normal">{a.basePrice}</th>
                <th scope="col" className="px-3 py-2.5 text-end font-normal">{a.roomCount}</th>
                <th scope="col" className="w-12 px-2"><span className="sr-only">{a.edit}</span></th>
              </tr>
            </thead>
            <tbody>
              {types.data.map((rt) =>
                typeDraft?.id === rt.id ? (
                  <Fragment key={rt.id}>{typeForm(typeDraft)}</Fragment>
                ) : (
                  <tr key={rt.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium" dir="ltr">{rt.code}</td>
                    <td className="px-3 py-3">{rt.name}</td>
                    <td className="px-3 py-3">{a.persons(rt.capacity ?? 0)}</td>
                    <td className="px-3 py-3 text-end">{formatters(lang, rt.currency).amount(rt.basePrice ?? 0)}</td>
                    <td className="px-3 py-3 text-end">{countByType.get(rt.id) ?? 0}</td>
                    <td className="px-2 py-3 text-end">{!typeDraft && editButton(`${a.edit} ${rt.code}`, () => editType(rt))}</td>
                  </tr>
                ),
              )}
              {typeDraft && !typeDraft.id && typeForm(typeDraft)}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="rooms-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rooms-title" className="text-xl font-semibold tracking-tight">{a.rooms}</h2>
          {roomDraft === null && types.data.length > 0 && (
            <Button variant="secondary" onClick={() => editRoom()}><Plus className="size-4" aria-hidden />{a.newRoom}</Button>
          )}
        </div>
        {sortedRooms.length === 0 && !roomDraft ? (
          <p className="rounded-lg bg-surface px-5 py-4 text-ink-soft ring-1 ring-line">{a.noRooms}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-line text-[13px] text-ink-faint">
                  <th scope="col" className="px-4 py-2.5 text-start font-normal">{a.number}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-normal">{a.floor}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-normal">{a.type}</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-normal">{a.status}</th>
                  <th scope="col" className="w-12 px-2"><span className="sr-only">{a.edit}</span></th>
                </tr>
              </thead>
              <tbody>
                {sortedRooms.map((r) =>
                  roomDraft?.id === r.id ? (
                    <Fragment key={r.id}>{roomForm(roomDraft)}</Fragment>
                  ) : (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-medium" dir="ltr">{r.number}</td>
                      <td className="px-3 py-3">{r.floor ?? '–'}</td>
                      <td className="px-3 py-3">{typeById.get(r.roomTypeId)?.code ?? '–'}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[14px]">
                          <span className={`inline-block size-3 rounded-[3px] ${STATUS_STYLE[r.status]}`} aria-hidden />
                          {t.statuses[r.status]}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-end">{!roomDraft && editButton(`${a.edit} ${r.number}`, () => editRoom(r))}</td>
                    </tr>
                  ),
                )}
                {roomDraft && !roomDraft.id && roomForm(roomDraft)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
