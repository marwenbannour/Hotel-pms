'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { emptyGuestDraft, GuestForm, guestBody, useGuestsDict } from '@/components/guests/GuestForm';
import { Button, ErrorNote } from '@/components/ui';
import { api } from '@/lib/api';
import { splitProblem } from '@/lib/problem';
import type { Guest } from '@/lib/types';

export default function NewGuestPage() {
  const g = useGuestsDict();
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(emptyGuestDraft);

  const create = useMutation({
    mutationFn: () => api<Guest>('/guests', { method: 'POST', json: guestBody(draft) }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.setQueryData(['guest', data.id], data);
      router.push(`/guests/${data.id}`);
    },
  });
  const server = splitProblem(create.error);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <Link href="/guests" className="text-[14px] text-ink-soft hover:text-ink">{g.back}</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{g.newGuest}</h1>
      </header>

      <GuestForm value={draft} onChange={setDraft} errors={server.fields} />

      <ErrorNote>{server.message}</ErrorNote>

      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        <Button type="submit" disabled={create.isPending}>{create.isPending ? g.creating : g.create}</Button>
        <Link href="/guests" className="inline-flex items-center px-4 py-2 text-ink-soft hover:text-ink">{g.discard}</Link>
      </div>
    </form>
  );
}
