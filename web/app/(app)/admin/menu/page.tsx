'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { Button, ErrorNote, Field, fieldClass } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { ADMIN, PERMISSIONS } from '@/lib/i18n-admin';
import { useI18n } from '@/lib/lang-context';
import { splitProblem } from '@/lib/problem';
import type { NavigationItem } from '@/lib/types';
import { useMe } from '../../shell';

type Draft = Omit<NavigationItem, 'id' | 'version' | 'sortOrder'> & { id?: string; version?: number; sortOrder: string };

const ICON_NAMES = ['home', 'concierge', 'calendar', 'grid', 'users', 'sparkles', 'utensils', 'chart', 'receipt', 'settings', 'bed', 'menu', 'user-cog', 'log-in', 'log-out'];

export default function AdminMenuPage() {
  const { lang } = useI18n();
  const a = ADMIN[lang];
  const me = useMe();
  const qc = useQueryClient();
  const allowed = !!me.data?.permissions.includes('admin:navigation');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [conflict, setConflict] = useState(false);
  const [toDelete, setToDelete] = useState<NavigationItem | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);

  const items = useQuery({
    queryKey: ['navigation-items'],
    queryFn: async () => (await api<{ data: NavigationItem[] }>('/navigation-items')).data.data,
    enabled: allowed,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['navigation-items'] });
    qc.invalidateQueries({ queryKey: ['navigation'] });
  };
  const handle412 = (e: unknown) => {
    if (e instanceof ApiError && e.status === 412) {
      setConflict(true);
      setDraft(null);
      refresh();
    }
  };

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = {
        ...(d.id ? {} : { key: d.key.trim() }),
        parentKey: d.parentKey || null,
        path: d.path?.trim() || null,
        icon: d.icon || null,
        permission: d.permission || null,
        module: d.module.trim() || 'core',
        labelFr: d.labelFr.trim(),
        labelEn: d.labelEn.trim(),
        labelAr: d.labelAr.trim(),
        sortOrder: Number(d.sortOrder) || 0,
        enabled: d.enabled,
      };
      return d.id
        ? api<NavigationItem>(`/navigation-items/${d.id}`, { method: 'PATCH', json: body, headers: { 'If-Match': `"${d.version}"` } })
        : api<NavigationItem>('/navigation-items', { method: 'POST', json: body });
    },
    onSuccess: () => { setDraft(null); setConflict(false); refresh(); },
    onError: handle412,
  });
  const toggle = useMutation({
    mutationFn: (i: NavigationItem) =>
      api<NavigationItem>(`/navigation-items/${i.id}`, { method: 'PATCH', json: { enabled: !i.enabled }, headers: { 'If-Match': `"${i.version}"` } }),
    onSuccess: () => { setConflict(false); refresh(); },
    onError: handle412,
  });
  const remove = useMutation({
    mutationFn: (i: NavigationItem) => api<null>(`/navigation-items/${i.id}`, { method: 'DELETE', headers: { 'If-Match': `"${i.version}"` } }),
    onSuccess: () => { deleteDialog.current?.close(); setConflict(false); refresh(); },
    onError: (e) => { if (e instanceof ApiError && e.status === 412) deleteDialog.current?.close(); handle412(e); },
  });

  if (me.data && !allowed) return <p role="alert" className="py-16 text-[17px]">{a.forbidden}</p>;
  if (items.isError) return <p role="alert" className="py-16 text-[17px]">{a.loadError}</p>;
  if (!items.data) return <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />;

  const all = items.data;
  const label = (i: NavigationItem) => (lang === 'ar' ? i.labelAr : lang === 'en' ? i.labelEn : i.labelFr);
  const byOrder = (x: NavigationItem, y: NavigationItem) => x.sortOrder - y.sortOrder || x.key.localeCompare(y.key);
  const children = (key: string | null) => all.filter((i) => i.parentKey === key).sort(byOrder);
  const descendants = (key: string): number => children(key).reduce((n, c) => n + 1 + descendants(c.key), 0);
  const groups = all.filter((i) => !i.path);
  const errors = splitProblem(save.isError && !(save.error instanceof ApiError && save.error.status === 412) ? save.error : null);

  const startEdit = (i?: NavigationItem) => {
    save.reset();
    setDraft(
      i
        ? { ...i, sortOrder: String(i.sortOrder) }
        : { key: '', parentKey: null, path: '', icon: null, permission: null, module: 'core', labelFr: '', labelEn: '', labelAr: '', sortOrder: String(Math.max(0, ...all.map((x) => x.sortOrder)) + 10), enabled: true },
    );
  };

  const form = (d: Draft) => (
    <form
      onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(d); }}
      className="space-y-4 rounded-lg bg-surface p-5 ring-2 ring-brass/60"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={a.key} hint={a.keyHint} error={errors.fields.key}>
          <input className={fieldClass} dir="ltr" required disabled={!!d.id} pattern="[a-z0-9][a-z0-9._\-]{0,63}" value={d.key} onChange={(e) => setDraft({ ...d, key: e.target.value })} autoFocus={!d.id} />
        </Field>
        <Field label={a.parent} error={errors.fields.parentKey}>
          <select className={fieldClass} value={d.parentKey ?? ''} onChange={(e) => setDraft({ ...d, parentKey: e.target.value || null })}>
            <option value="">{a.noParent}</option>
            {groups.filter((g) => g.key !== d.key).map((g) => <option key={g.key} value={g.key}>{label(g)}</option>)}
          </select>
        </Field>
        <Field label={a.path} hint={a.pathHint} error={errors.fields.path}>
          <input className={fieldClass} dir="ltr" maxLength={200} value={d.path ?? ''} onChange={(e) => setDraft({ ...d, path: e.target.value })} />
        </Field>
        <Field label={a.labelFr} error={errors.fields.labelFr}>
          <input className={fieldClass} required value={d.labelFr} onChange={(e) => setDraft({ ...d, labelFr: e.target.value })} />
        </Field>
        <Field label={a.labelEn} error={errors.fields.labelEn}>
          <input className={fieldClass} required dir="ltr" value={d.labelEn} onChange={(e) => setDraft({ ...d, labelEn: e.target.value })} />
        </Field>
        <Field label={a.labelAr} error={errors.fields.labelAr}>
          <input className={fieldClass} required dir="rtl" lang="ar" value={d.labelAr} onChange={(e) => setDraft({ ...d, labelAr: e.target.value })} />
        </Field>
        <Field label={a.permission} error={errors.fields.permission}>
          <select className={fieldClass} dir="ltr" value={d.permission ?? ''} onChange={(e) => setDraft({ ...d, permission: e.target.value || null })}>
            <option value="">{a.everyone}</option>
            {PERMISSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label={a.icon} error={errors.fields.icon}>
          <select className={fieldClass} dir="ltr" value={d.icon ?? ''} onChange={(e) => setDraft({ ...d, icon: e.target.value || null })}>
            <option value="">–</option>
            {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={a.module} error={errors.fields.module}>
            <input className={fieldClass} dir="ltr" required value={d.module} onChange={(e) => setDraft({ ...d, module: e.target.value })} />
          </Field>
          <Field label={a.order} error={errors.fields.sortOrder}>
            <input className={fieldClass} type="number" required value={d.sortOrder} onChange={(e) => setDraft({ ...d, sortOrder: e.target.value })} />
          </Field>
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="size-4 accent-ink" checked={d.enabled} onChange={(e) => setDraft({ ...d, enabled: e.target.checked })} />
        {a.enabled}
      </label>
      <ErrorNote>{errors.message}</ErrorNote>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? a.saving : a.save}</Button>
        <Button variant="ghost" onClick={() => setDraft(null)}>{a.cancel}</Button>
      </div>
    </form>
  );

  const row = (i: NavigationItem, depth: number): React.ReactNode => (
    <li key={i.id}>
      {draft?.id === i.id ? (
        <div className="py-2">{form(draft)}</div>
      ) : (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-3 pe-2 ${depth ? 'ps-10' : 'ps-4'} ${i.enabled ? '' : 'opacity-60'}`}>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {label(i)}
              {!i.path && <span className="ms-2 text-[12px] font-normal text-ink-faint">{a.group}</span>}
              {!i.enabled && <span className="ms-2 rounded-full bg-line px-2 py-0.5 text-[12px] font-normal">{a.hidden}</span>}
            </p>
            <p className="text-[13px] text-ink-faint" dir="ltr">
              {[i.path, i.permission ?? a.everyone, i.module !== 'core' ? `module ${i.module}` : null, `#${i.sortOrder}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          {!draft && (
            <div className="flex items-center gap-1">
              <button type="button" className="rounded p-1.5 text-ink-soft hover:bg-paper hover:text-ink" title={i.enabled ? a.hide : a.show} aria-label={`${i.enabled ? a.hide : a.show} : ${label(i)}`} disabled={toggle.isPending} onClick={() => toggle.mutate(i)}>
                {i.enabled ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
              <button type="button" className="rounded p-1.5 text-ink-soft hover:bg-paper hover:text-ink" title={a.edit} aria-label={`${a.edit} : ${label(i)}`} onClick={() => startEdit(i)}>
                <Pencil className="size-4" aria-hidden />
              </button>
              <button type="button" className="rounded p-1.5 text-ink-soft hover:bg-paper hover:text-maintenance" title={a.delete} aria-label={`${a.delete} : ${label(i)}`} onClick={() => { remove.reset(); setToDelete(i); deleteDialog.current?.showModal(); }}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
      {children(i.key).length > 0 && <ul>{children(i.key).map((c) => row(c, depth + 1))}</ul>}
    </li>
  );

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{a.menuTitle}</h1>
        {!draft && <Button variant="secondary" onClick={() => startEdit()}><Plus className="size-4" aria-hidden />{a.newEntry}</Button>}
      </header>
      <p className="text-ink-soft">{a.menuHelp}</p>
      {conflict && <ErrorNote>{a.conflict}</ErrorNote>}
      <ErrorNote>{splitProblem(toggle.isError && !(toggle.error instanceof ApiError && toggle.error.status === 412) ? toggle.error : null).message}</ErrorNote>
      {draft && !draft.id && form(draft)}
      <ul className="rounded-lg bg-surface ring-1 ring-line [&>li:last-child>div]:border-0">{children(null).map((i) => row(i, 0))}</ul>

      <dialog ref={deleteDialog} onClose={() => setToDelete(null)} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg p-0 backdrop:bg-ink/40">
        {toDelete && (
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">{a.deleteEntry}</h2>
            <p className="text-ink-soft">{a.deleteEntryHelp(label(toDelete), descendants(toDelete.key))}</p>
            <ErrorNote>{splitProblem(remove.error).message}</ErrorNote>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => deleteDialog.current?.close()}>{a.cancel}</Button>
              <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(toDelete)}>{a.delete}</Button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
