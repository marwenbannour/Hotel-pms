'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, ShieldOff } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { Button, ErrorNote, Field, fieldClass } from '@/components/ui';
import { api } from '@/lib/api';
import { ADMIN, ROLES } from '@/lib/i18n-admin';
import { useI18n } from '@/lib/lang-context';
import { splitProblem } from '@/lib/problem';
import type { AppUser } from '@/lib/types';
import { useMe } from '../../shell';

const MIN_PASSWORD = 12;
/** Sans caractères ambigus (0/O, 1/l/I) : le mot de passe est souvent dicté ou recopié. */
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePassword(length = 16) {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

type Dialog =
  | { kind: 'create' }
  | { kind: 'password'; user: AppUser }
  | { kind: 'mfa'; user: AppUser }
  | { kind: 'deactivate'; user: AppUser };

interface Edit { id: string; fullName: string; role: string; locale: string }

export default function AdminUsersPage() {
  const { lang, f } = useI18n();
  const a = ADMIN[lang];
  const me = useMe();
  const qc = useQueryClient();
  const allowed = !!me.data?.permissions.includes('admin:users');
  const isAdmin = me.data?.role === 'admin';
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'reception', locale: 'fr', password: '' });
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api<{ data: AppUser[] }>('/users')).data.data,
    enabled: allowed,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });

  const open = (d: Dialog) => {
    action.reset();
    setNotice(null);
    if (d.kind === 'create') setForm({ fullName: '', email: '', role: 'reception', locale: lang, password: generatePassword() });
    if (d.kind === 'password') setForm((cur) => ({ ...cur, password: generatePassword() }));
    setDialog(d);
    dialogRef.current?.showModal();
  };
  const close = () => {
    dialogRef.current?.close();
    setDialog(null);
  };

  /** Toutes les actions passent par une seule mutation : un dialogue, un message de confirmation. */
  const action = useMutation({
    mutationFn: async (d: Dialog) => {
      switch (d.kind) {
        case 'create':
          await api<AppUser>('/users', { method: 'POST', json: { ...form, email: form.email.trim(), fullName: form.fullName.trim() } });
          return a.done.created(form.fullName.trim());
        case 'password':
          await api<AppUser>(`/users/${d.user.id}/password`, { method: 'POST', json: { password: form.password } });
          return a.done.password(d.user.fullName);
        case 'mfa':
          await api<AppUser>(`/users/${d.user.id}/mfa/reset`, { method: 'POST', json: {} });
          return a.done.mfa(d.user.fullName);
        case 'deactivate':
          await api<AppUser>(`/users/${d.user.id}`, { method: 'PATCH', json: { active: false } });
          return null;
      }
    },
    onSuccess: (message) => {
      close();
      setNotice(message);
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<Edit> & { id: string; active?: boolean }) => api<AppUser>(`/users/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => {
      setEdit(null);
      refresh();
    },
  });

  if (me.data && !allowed) return <p role="alert" className="py-16 text-[17px]">{a.forbidden}</p>;
  if (users.isError) return <p role="alert" className="py-16 text-[17px]">{a.loadError}</p>;
  if (!users.data) return <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />;

  // Le profil IT ne voit pas le rôle Direction dans les choix et ne peut pas agir sur ces comptes.
  const roleChoices = ROLES.filter((r) => isAdmin || r !== 'admin');
  const canManage = (u: AppUser) => isAdmin || u.role !== 'admin';
  const actionErrors = splitProblem(action.error);
  const updateError = splitProblem(update.error).message;
  const iconButton = 'rounded p-1.5 text-ink-soft hover:bg-paper hover:text-ink disabled:opacity-40';

  const mfaLabel = (u: AppUser) => (u.mfaEnabled ? a.mfaOn : u.mfaRequired ? a.mfaPending : a.mfaOff);

  return (
    <div className="max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{a.usersTitle}</h1>
        <Button onClick={() => open({ kind: 'create' })}><Plus className="size-4" aria-hidden />{a.newUser}</Button>
      </header>

      {notice && <p role="status" className="rounded-md bg-available/10 px-3 py-2 text-available">{notice}</p>}
      <ErrorNote>{updateError}</ErrorNote>

      <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-line text-[13px] text-ink-faint">
              <th scope="col" className="px-4 py-2.5 text-start font-normal">{a.fullName}</th>
              <th scope="col" className="px-3 py-2.5 text-start font-normal">{a.role}</th>
              <th scope="col" className="px-3 py-2.5 text-start font-normal">{a.language}</th>
              <th scope="col" className="px-3 py-2.5 text-start font-normal">{a.mfa}</th>
              <th scope="col" className="px-3 py-2.5 text-start font-normal">{a.account}</th>
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">{a.edit}</span></th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((u) => {
              const self = u.id === me.data?.id;
              const manageable = canManage(u);
              if (edit?.id === u.id) {
                return (
                  <tr key={u.id} className="border-b border-line bg-paper/60 last:border-0">
                    <td colSpan={6} className="px-4 py-3">
                      <form
                        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto] sm:items-end"
                        onSubmit={(e: FormEvent) => {
                          e.preventDefault();
                          update.mutate({ id: u.id, fullName: edit.fullName, locale: edit.locale, ...(self ? {} : { role: edit.role }) });
                        }}
                      >
                        <label className="text-[13px] text-ink-soft">{a.fullName}
                          <input className={`${fieldClass} mt-0.5`} required maxLength={120} value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} autoFocus />
                        </label>
                        <label className="text-[13px] text-ink-soft">{a.role}
                          <select className={`${fieldClass} mt-0.5`} disabled={self} title={self ? a.selfHint : undefined} value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                            {roleChoices.map((r) => <option key={r} value={r}>{a.roles[r]}</option>)}
                          </select>
                        </label>
                        <label className="text-[13px] text-ink-soft">{a.language}
                          <select className={`${fieldClass} mt-0.5`} value={edit.locale} onChange={(e) => setEdit({ ...edit, locale: e.target.value })}>
                            {Object.entries(a.languages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </label>
                        <div className="flex gap-2">
                          <Button type="submit" disabled={update.isPending}>{update.isPending ? a.saving : a.save}</Button>
                          <Button variant="ghost" onClick={() => setEdit(null)}>{a.cancel}</Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={u.id} className={`border-b border-line last:border-0 ${u.active ? '' : 'text-ink-faint'}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{u.fullName}</span>
                    {self && <span className="ms-2 text-[12px] text-ink-faint">({a.you})</span>}
                    <span className="block text-[13px] text-ink-faint" dir="ltr">{u.email}</span>
                  </td>
                  <td className="px-3 py-3">{a.roles[u.role] ?? u.role}</td>
                  <td className="px-3 py-3">{a.languages[u.locale]}</td>
                  <td className="px-3 py-3">
                    <span className={u.mfaRequired && !u.mfaEnabled ? 'text-cleaning' : ''}>{mfaLabel(u)}</span>
                  </td>
                  <td className="px-3 py-3">
                    {u.active ? a.active : <span className="rounded-full bg-line px-2 py-0.5 text-[13px]">{a.inactive}</span>}
                    <span className="block text-[12px] text-ink-faint">{f.instantDate(u.createdAt, me.data?.hotel.timezone)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {manageable && !edit && (
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className={iconButton} title={a.edit} aria-label={`${a.edit} : ${u.fullName}`} onClick={() => { update.reset(); setEdit({ id: u.id, fullName: u.fullName, role: u.role, locale: u.locale }); }}>
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <button type="button" className={iconButton} title={a.resetPassword} aria-label={`${a.resetPassword} : ${u.fullName}`} onClick={() => open({ kind: 'password', user: u })}>
                          <KeyRound className="size-4" aria-hidden />
                        </button>
                        <button type="button" className={iconButton} disabled={!u.mfaEnabled} title={a.resetMfa} aria-label={`${a.resetMfa} : ${u.fullName}`} onClick={() => open({ kind: 'mfa', user: u })}>
                          <ShieldOff className="size-4" aria-hidden />
                        </button>
                        {!self &&
                          (u.active ? (
                            <Button variant="ghost" className="px-2 py-1 text-maintenance" onClick={() => open({ kind: 'deactivate', user: u })}>{a.deactivate}</Button>
                          ) : (
                            <Button variant="ghost" className="px-2 py-1" disabled={update.isPending} onClick={() => update.mutate({ id: u.id, active: true })}>{a.activate}</Button>
                          ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dialog ref={dialogRef} onClose={() => setDialog(null)} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg p-0 backdrop:bg-ink/40">
        {dialog && (
          <form
            method="dialog"
            className="space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              action.mutate(dialog);
            }}
          >
            {dialog.kind === 'create' && (
              <>
                <h2 className="text-lg font-semibold">{a.newUser}</h2>
                <Field label={a.fullName} error={actionErrors.fields.fullName}>
                  <input className={fieldClass} required maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoFocus />
                </Field>
                <Field label={a.email} error={actionErrors.fields.email}>
                  <input className={fieldClass} type="email" dir="ltr" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={a.role}>
                    <select className={fieldClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      {roleChoices.map((r) => <option key={r} value={r}>{a.roles[r]}</option>)}
                    </select>
                  </Field>
                  <Field label={a.language}>
                    <select className={fieldClass} value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
                      {Object.entries(a.languages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            )}
            {dialog.kind === 'password' && (
              <>
                <h2 className="text-lg font-semibold">{a.resetPassword}</h2>
                <p className="text-ink-soft">{a.resetPasswordHelp(dialog.user.fullName)}</p>
              </>
            )}
            {(dialog.kind === 'create' || dialog.kind === 'password') && (
              <Field label={dialog.kind === 'create' ? a.password : a.newPassword} hint={a.passwordHint} error={actionErrors.fields.password}>
                <div className="flex gap-2">
                  <input
                    className={`${fieldClass} font-mono`}
                    dir="ltr"
                    required
                    minLength={MIN_PASSWORD}
                    maxLength={128}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                  <Button variant="secondary" className="mt-1" onClick={() => setForm({ ...form, password: generatePassword() })}>{a.generate}</Button>
                </div>
              </Field>
            )}
            {dialog.kind === 'mfa' && (
              <>
                <h2 className="text-lg font-semibold">{a.resetMfa}</h2>
                <p className="text-ink-soft">{a.resetMfaHelp(dialog.user.fullName)}</p>
              </>
            )}
            {dialog.kind === 'deactivate' && (
              <>
                <h2 className="text-lg font-semibold">{a.deactivate} : {dialog.user.fullName}</h2>
                <p className="text-ink-soft">{a.deactivateHelp(dialog.user.fullName)}</p>
              </>
            )}
            <ErrorNote>{actionErrors.message}</ErrorNote>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={close}>{a.cancel}</Button>
              <Button type="submit" variant={dialog.kind === 'deactivate' || dialog.kind === 'mfa' ? 'danger' : 'primary'} disabled={action.isPending}>
                {dialog.kind === 'create' ? a.create : a.confirm}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
