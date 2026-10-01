'use client';

import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Button, useDebounced } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays } from '@/lib/dates';
import { formatters } from '@/lib/i18n';
import { BILLING } from '@/lib/i18n-billing';
import { useI18n } from '@/lib/lang-context';
import type { Invoice, Page } from '@/lib/types';
import { useHotelToday, useMe } from '../shell';

export default function InvoicesPage() {
  const { lang, f } = useI18n();
  const b = BILLING[lang];
  const me = useMe();
  const can = (p: string) => !!me.data?.permissions.includes(p);
  const today = useHotelToday();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const q = useDebounced(search.trim(), 300);
  const params = new URLSearchParams({ limit: '50', ...(q.length >= 2 ? { q } : {}), ...(kind ? { kind } : {}) });

  const list = useInfiniteQuery({
    queryKey: ['invoices', params.toString()],
    initialPageParam: '',
    queryFn: async ({ pageParam }) =>
      (await api<Page<Invoice>>(`/invoices?${params}${pageParam ? `&cursor=${pageParam}` : ''}`)).data,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];

  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const integrity = useMutation({
    mutationFn: async () =>
      (await api<{ valid: boolean; checked: number; errors: { number: string; problem: string }[] }>('/invoices/integrity')).data,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">{b.invoicesTitle}</h1>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={b.searchInvoices}
          aria-label={b.searchInvoices}
          className="min-w-64 flex-1 rounded-md border border-line bg-surface px-3 py-2"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={b.kind} className="rounded-md border border-line bg-surface px-3 py-2">
          <option value="">{b.allDocuments}</option>
          <option value="invoice">{b.onlyInvoices}</option>
          <option value="credit_note">{b.onlyCredits}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-line text-[13px] text-ink-faint">
              <th scope="col" className="px-5 py-2.5 text-start font-normal">{b.number}</th>
              <th scope="col" className="px-2 py-2.5 text-start font-normal">{b.date}</th>
              <th scope="col" className="px-2 py-2.5 text-start font-normal">{b.customer}</th>
              <th scope="col" className="px-5 py-2.5 text-end font-normal">{b.totalTtc}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                <td className="px-5 py-3">
                  <Link href={`/invoices/${inv.id}`} className="font-medium underline-offset-4 hover:underline" dir="ltr">{inv.number}</Link>
                  <span className="block text-[13px] text-ink-faint">{inv.kind === 'invoice' ? b.invoice : b.creditNote}</span>
                </td>
                <td className="px-2 py-3">{f.shortDate(inv.issueDate)}</td>
                <td className="px-2 py-3"><bdi>{inv.customer.name}</bdi></td>
                <td className={`px-5 py-3 text-end ${inv.totals.ttc < 0 ? 'text-maintenance' : ''}`}>{formatters(lang, inv.currency).amount(inv.totals.ttc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.isSuccess && rows.length === 0 && <p className="px-5 py-8 text-ink-soft">{b.noInvoices}</p>}
      </div>
      {list.hasNextPage && (
        <Button variant="secondary" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>{b.loadMore}</Button>
      )}

      {(can('billing:export') || can('billing:override')) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {can('billing:export') && (
            <section aria-labelledby="export-title" className="space-y-3 rounded-lg bg-surface p-5 ring-1 ring-line">
              <h2 id="export-title" className="text-lg font-semibold">{b.export}</h2>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-[14px]">
                  <span className="block text-ink-soft">{b.exportFrom}</span>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 rounded-md border border-line px-2 py-1.5" />
                </label>
                <label className="text-[14px]">
                  <span className="block text-ink-soft">{b.exportTo}</span>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 rounded-md border border-line px-2 py-1.5" />
                </label>
                <a
                  href={`/api/v1/accounting/exports?from=${from}&to=${addDays(to, 1)}`}
                  className="inline-flex items-center rounded-md bg-ink px-4 py-2 font-medium text-white hover:bg-ink/90"
                >
                  {b.download}
                </a>
              </div>
            </section>
          )}
          {can('billing:override') && (
            <section aria-labelledby="integrity-title" className="space-y-3 rounded-lg bg-surface p-5 ring-1 ring-line">
              <h2 id="integrity-title" className="text-lg font-semibold">{b.integrity}</h2>
              <Button variant="secondary" onClick={() => integrity.mutate()} disabled={integrity.isPending}>{b.runIntegrity}</Button>
              <div aria-live="polite">
                {integrity.data?.valid && <p className="text-available">{b.integrityOk(integrity.data.checked)}</p>}
                {integrity.data && !integrity.data.valid && (
                  <div role="alert" className="text-maintenance">
                    <p className="font-medium">{b.integrityKo}</p>
                    <ul className="list-disc ps-5">
                      {integrity.data.errors.map((e) => <li key={e.number + e.problem}><span dir="ltr">{e.number}</span> : {e.problem}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
