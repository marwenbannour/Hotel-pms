'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button, ErrorNote, Field, fieldClass } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { BILLING, ratePct } from '@/lib/i18n-billing';
import { dirOf, formatters } from '@/lib/i18n';
import { useI18n } from '@/lib/lang-context';
import { splitProblem } from '@/lib/problem';
import type { Invoice } from '@/lib/types';
import { useMe } from '../../shell';

/** Facture imprimable : mise en page A4, dans la langue choisie à l'émission (RTL pour l'arabe). */
export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useI18n();
  const ui = BILLING[lang];
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['invoice', id], queryFn: async () => (await api<Invoice>(`/invoices/${id}`)).data });

  const dialog = useRef<HTMLDialogElement>(null);
  const creditKey = useRef(newIdempotencyKey());
  const [reason, setReason] = useState('');
  const credit = useMutation({
    mutationFn: () =>
      api<Invoice>(`/invoices/${id}/credit-note`, { method: 'POST', headers: { 'Idempotency-Key': creditKey.current }, json: { reason } }),
    onSuccess: (res) => {
      dialog.current?.close();
      qc.invalidateQueries({ queryKey: ['invoice'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['folio'] });
      router.push(`/invoices/${res.data.id}`);
    },
  });

  if (q.isError) return <p role="alert" className="py-16">{ui.noInvoices}</p>;
  if (!q.data) return <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />;
  const inv = q.data;
  const b = BILLING[inv.lang];
  const d = b.doc;
  const f = formatters(inv.lang, inv.currency);
  const isCredit = inv.kind === 'credit_note';
  const canCredit = !isCredit && !inv.creditNote && !!me.data?.permissions.includes('billing:override');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/invoices" className="text-[14px] text-ink-soft hover:text-ink">{ui.backToList}</Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/reservations/${inv.reservationId}`} className="inline-flex items-center px-3 py-2 text-[14px] text-ink-soft hover:text-ink">
            {d.reservation}
          </Link>
          {canCredit && (
            <Button variant="secondary" onClick={() => { credit.reset(); setReason(''); creditKey.current = newIdempotencyKey(); dialog.current?.showModal(); }}>
              {ui.issueCredit}
            </Button>
          )}
          <Button onClick={() => window.print()}>{ui.print}</Button>
        </div>
      </div>
      {inv.creditNote && (
        <p className="rounded-md bg-maintenance/10 px-4 py-2.5 text-maintenance print:hidden">
          {ui.creditedBy(inv.creditNote.number)}{' '}
          <Link href={`/invoices/${inv.creditNote.id}`} className="font-medium underline underline-offset-4">{inv.creditNote.number}</Link>
        </p>
      )}

      {/* Feuille A4 */}
      <article
        lang={inv.lang}
        dir={dirOf(inv.lang)}
        className="mx-auto w-full max-w-[210mm] bg-white px-[14mm] py-[16mm] text-[13px] leading-5 text-ink shadow-sm ring-1 ring-line print:max-w-none print:px-0 print:py-0 print:shadow-none print:ring-0"
      >
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-5">
          <div>
            <p dir="auto" className="text-[17px] font-semibold rtl:text-right">{inv.seller.legalName}</p>
            {/* Données saisies dans une autre langue : dir="auto" préserve leur sens d'écriture. */}
            {inv.seller.address && <p dir="auto" className="whitespace-pre-line text-ink-soft rtl:text-right">{inv.seller.address}</p>}
            {inv.seller.taxId && <p className="text-ink-soft">{d.taxId} <span dir="ltr">{inv.seller.taxId}</span></p>}
            {inv.seller.registration && <p className="text-ink-soft">{d.registration} <span dir="ltr">{inv.seller.registration}</span></p>}
          </div>
          <div className="text-end">
            <h1 className="text-2xl font-semibold tracking-tight">{isCredit ? d.creditNote : d.invoice}</h1>
            <p className="mt-1">{d.number} <span dir="ltr" className="font-semibold">{inv.number}</span></p>
            <p className="text-ink-soft">{d.issueDate} {f.longDate(inv.issueDate)}</p>
          </div>
        </header>

        <section className="grid gap-6 py-5 sm:grid-cols-2">
          <div>
            <h2 className="text-[12px] text-ink-faint">{d.customer}</h2>
            <p className="font-medium"><bdi>{inv.customer.name}</bdi></p>
            {inv.customer.email && <p dir="ltr" className="text-ink-soft [unicode-bidi:plaintext] text-start">{inv.customer.email}</p>}
          </div>
          <div>
            <h2 className="text-[12px] text-ink-faint">{d.reservation}</h2>
            <p dir="ltr" className="font-medium text-start [unicode-bidi:plaintext]">{inv.customer.reservation}</p>
            {isCredit && inv.creditedInvoiceNumber && <p className="mt-2">{d.creditFor(inv.creditedInvoiceNumber)}</p>}
            {isCredit && inv.reason && <p className="text-ink-soft">{d.reason} : {inv.reason}</p>}
          </div>
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-ink text-[12px]">
              <th scope="col" className="py-2 pe-3 text-start font-medium">{b.line}</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">{b.qty}</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">{d.unitTtc}</th>
              <th scope="col" className="px-2 py-2 text-end font-medium">{d.vatRate}</th>
              <th scope="col" className="py-2 ps-2 text-end font-medium">{b.amount}</th>
            </tr>
          </thead>
          <tbody>
            {(inv.lines ?? []).map((l) => (
              <tr key={l.position} className="border-b border-line align-top">
                <td className="py-2 pe-3"><bdi>{l.description}</bdi></td>
                <td className="px-2 py-2 text-end">{l.quantity}</td>
                <td className="px-2 py-2 text-end whitespace-nowrap">{f.amount(l.unitAmount)}</td>
                <td className="px-2 py-2 text-end">{ratePct(l.vatRate, inv.lang)}</td>
                <td className="py-2 ps-2 text-end whitespace-nowrap">{f.amount(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-[12px] text-ink-faint">{d.vatSummary}</h2>
            <table className="w-full">
              <thead>
                <tr className="text-[12px] text-ink-soft">
                  <th scope="col" className="py-1 text-start font-normal">{d.vatRate}</th>
                  <th scope="col" className="py-1 text-end font-normal">{d.base}</th>
                  <th scope="col" className="py-1 text-end font-normal">{b.vat}</th>
                </tr>
              </thead>
              <tbody>
                {inv.totals.breakdown.map((v) => (
                  <tr key={v.rate}>
                    <td className="py-0.5">{ratePct(v.rate, inv.lang)}</td>
                    <td className="py-0.5 text-end">{f.amount(v.base)}</td>
                    <td className="py-0.5 text-end">{f.amount(v.vat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="space-y-1 self-end">
            <div className="flex justify-between"><dt>{b.totalHt}</dt><dd>{f.amount(inv.totals.ht)}</dd></div>
            <div className="flex justify-between"><dt>{b.totalVat}</dt><dd>{f.amount(inv.totals.vat)}</dd></div>
            <div className="flex justify-between border-t-2 border-ink pt-2 text-[17px] font-semibold"><dt>{b.totalTtc}</dt><dd>{f.amount(inv.totals.ttc)}</dd></div>
          </dl>
        </div>

        <footer className="mt-10 space-y-2 border-t border-line pt-4 text-[11px] text-ink-soft">
          {inv.seller.footer && <p dir="auto" className="whitespace-pre-line rtl:text-right">{inv.seller.footer}</p>}
          <p>
            {d.fingerprint} <span dir="ltr" className="break-all">{inv.hash}</span>
          </p>
        </footer>
      </article>

      <dialog ref={dialog} className="m-auto w-[min(28rem,92vw)] rounded-lg p-0 backdrop:bg-ink/40 print:hidden" aria-labelledby="credit-title">
        <form method="dialog" className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); credit.mutate(); }}>
          <h2 id="credit-title" className="text-lg font-semibold">{ui.issueCredit}</h2>
          <Field label={ui.creditReason}>
            <textarea className={fieldClass} rows={3} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <ErrorNote>{splitProblem(credit.error).message}</ErrorNote>
          <div className="flex gap-3">
            <Button type="submit" variant="danger" disabled={credit.isPending}>{ui.confirmCredit}</Button>
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>{ui.close}</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
