'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { RES } from '@/lib/i18n-res';
import { useI18n } from '@/lib/lang-context';
import type { Page, Reservation } from '@/lib/types';

/** Recherche rapide d'une réservation (référence, nom ou email du client) depuis le tableau de bord. */
export function ReservationSearch() {
  const { lang, t, f } = useI18n();
  const r = RES[lang];
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Requête envoyée 250 ms après la dernière frappe, à partir de 2 caractères (minimum de l'API).
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const results = useQuery({
    queryKey: ['reservations', 'quick-search', q],
    queryFn: async () => (await api<Page<Reservation>>(`/reservations?${new URLSearchParams({ q, limit: '6' })}`)).data.data,
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
  const show = open && q.length >= 2;

  return (
    <div ref={boxRef} className="relative w-full sm:w-72" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <label className="flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-gold">
        <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
        <span className="sr-only">{r.search}</span>
        <input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={r.searchPlaceholder}
          className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-faint focus-visible:outline-none"
        />
      </label>
      {show && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-xl bg-surface py-1.5 shadow-lg ring-1 ring-line" role="region" aria-label={t.searchResults}>
          {!results.data ? (
            <p className="px-4 py-2.5 text-[14px] text-ink-soft">{t.refreshing}</p>
          ) : results.data.length === 0 ? (
            <p className="px-4 py-2.5 text-[14px] text-ink-soft">{r.noResults}</p>
          ) : (
            <ul>
              {results.data.map((res) => (
                <li key={res.id}>
                  <Link href={`/reservations/${res.id}`} className="block px-4 py-2 hover:bg-paper" onClick={() => setOpen(false)}>
                    <span className="block font-medium">{[res.guest.firstName, res.guest.lastName].filter(Boolean).join(' ')}</span>
                    <span className="block text-[13px] text-ink-soft">
                      <span dir="ltr">{res.reference}</span> · {f.dayMonth(res.arrivalDate)} – {f.dayMonth(res.departureDate)} · {r.statuses[res.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
