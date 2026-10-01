'use client';

import { GUEST_SEGMENTS, GUESTS } from '@/lib/i18n-guests';
import { useI18n } from '@/lib/lang-context';
import type { Guest } from '@/lib/types';
import { Field, fieldClass } from '../ui';

export interface GuestDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  segment: string;
}

export const emptyGuestDraft: GuestDraft = { firstName: '', lastName: '', email: '', phone: '', nationality: '', segment: 'individual' };

export const draftFromGuest = (g: Guest): GuestDraft => ({
  firstName: g.firstName,
  lastName: g.lastName,
  email: g.email ?? '',
  phone: g.phone ?? '',
  nationality: g.nationality ?? '',
  segment: g.segment,
});

/**
 * Corps envoyé à l'API. À la création, les champs vides sont omis ; à la modification,
 * seuls les champs changés sont envoyés et un champ vidé devient null.
 */
export function guestBody(d: GuestDraft, current?: Guest): Record<string, unknown> {
  const clean: Record<keyof GuestDraft, string> = {
    firstName: d.firstName.trim(),
    lastName: d.lastName.trim(),
    email: d.email.trim(),
    phone: d.phone.trim(),
    nationality: d.nationality.trim().toUpperCase(),
    segment: d.segment,
  };
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(clean) as [keyof GuestDraft, string][]) {
    if (!current) {
      if (v) body[k] = v;
    } else if (v !== ((current[k] as string | null) ?? '')) {
      body[k] = v || null;
    }
  }
  return body;
}

export function useGuestsDict() {
  const { lang } = useI18n();
  return GUESTS[lang];
}

export function GuestForm({
  value,
  onChange,
  errors = {},
}: {
  value: GuestDraft;
  onChange: (v: GuestDraft) => void;
  errors?: Record<string, string>;
}) {
  const g = useGuestsDict();
  const set = (k: keyof GuestDraft, v: string) => onChange({ ...value, [k]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={g.firstName} error={errors.firstName}>
        <input className={fieldClass} required maxLength={100} value={value.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" />
      </Field>
      <Field label={g.lastName} error={errors.lastName}>
        <input className={fieldClass} required maxLength={100} value={value.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />
      </Field>
      <Field label={g.email} error={errors.email}>
        <input type="email" dir="ltr" className={fieldClass} value={value.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
      </Field>
      <Field label={g.phone} error={errors.phone}>
        <input type="tel" dir="ltr" className={fieldClass} value={value.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="off" />
      </Field>
      <Field label={g.nationality} hint={g.nationalityHint} error={errors.nationality}>
        <input
          dir="ltr"
          className={`${fieldClass} uppercase`}
          maxLength={2}
          pattern="[A-Za-z]{2}"
          value={value.nationality}
          onChange={(e) => set('nationality', e.target.value.toUpperCase())}
          autoComplete="off"
        />
      </Field>
      <Field label={g.segment} error={errors.segment}>
        <select className={fieldClass} value={value.segment} onChange={(e) => set('segment', e.target.value)}>
          {GUEST_SEGMENTS.map((s) => (
            <option key={s} value={s}>{g.segments[s]}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}
