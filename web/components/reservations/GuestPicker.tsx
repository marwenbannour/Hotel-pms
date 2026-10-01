'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRes } from '@/lib/lang-context';
import type { Guest, Page } from '@/lib/types';
import { Button, Field, fieldClass, useDebounced } from '../ui';

export interface NewGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface GuestChoice {
  existing: Guest | null;
  search: string;
  draft: NewGuest;
}

export const emptyGuestChoice: GuestChoice = { existing: null, search: '', draft: { firstName: '', lastName: '', email: '', phone: '' } };

export function GuestPicker({
  value,
  onChange,
  errors = {},
}: {
  value: GuestChoice;
  onChange: (v: GuestChoice) => void;
  errors?: Record<string, string>;
}) {
  const r = useRes();
  const term = useDebounced(value.search.trim(), 300);
  const results = useQuery({
    queryKey: ['guests', 'search', term],
    queryFn: async () => (await api<Page<Guest>>(`/guests?q=${encodeURIComponent(term)}&limit=6`)).data.data,
    enabled: term.length >= 2 && !value.existing,
  });
  const setDraft = (k: keyof NewGuest, v: string) => onChange({ ...value, draft: { ...value.draft, [k]: v } });

  if (value.existing) {
    const g = value.existing;
    return (
      <div className="flex items-start justify-between gap-4 rounded-md bg-surface p-4 ring-1 ring-line">
        <div>
          <span className="text-[13px] text-ink-faint">{r.existingGuest}</span>
          <p className="font-medium">{g.firstName} {g.lastName}</p>
          <p className="text-[14px] text-ink-soft" dir="ltr">{[g.email, g.phone].filter(Boolean).join(', ')}</p>
        </div>
        <Button variant="secondary" onClick={() => onChange({ ...value, existing: null })}>{r.change}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Field label={r.findGuest}>
          <input type="search" className={fieldClass} value={value.search} onChange={(e) => onChange({ ...value, search: e.target.value })} placeholder={r.searchPlaceholder} />
        </Field>
        {term.length >= 2 && results.data && (
          <ul className="mt-2 divide-y divide-line rounded-md bg-surface ring-1 ring-line">
            {results.data.length === 0 && <li className="px-4 py-3 text-[14px] text-ink-soft">{r.noGuestFound}</li>}
            {results.data.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, existing: g })}
                  className="flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-start hover:bg-paper"
                >
                  <span className="font-medium">{g.firstName} {g.lastName}</span>
                  <span className="truncate text-[13px] text-ink-faint" dir="ltr">{g.email ?? g.phone ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-[14px] font-medium">{r.newGuest}</legend>
        <Field label={r.firstName} error={errors['guest.firstName']}>
          <input className={fieldClass} value={value.draft.firstName} onChange={(e) => setDraft('firstName', e.target.value)} autoComplete="off" />
        </Field>
        <Field label={r.lastName} error={errors['guest.lastName']}>
          <input className={fieldClass} value={value.draft.lastName} onChange={(e) => setDraft('lastName', e.target.value)} autoComplete="off" />
        </Field>
        <Field label={r.email} error={errors['guest.email']}>
          <input type="email" dir="ltr" className={fieldClass} value={value.draft.email} onChange={(e) => setDraft('email', e.target.value)} autoComplete="off" />
        </Field>
        <Field label={r.phone} error={errors['guest.phone']}>
          <input type="tel" dir="ltr" className={fieldClass} value={value.draft.phone} onChange={(e) => setDraft('phone', e.target.value)} autoComplete="off" />
        </Field>
      </fieldset>
    </div>
  );
}
