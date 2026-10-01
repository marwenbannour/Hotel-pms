'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button, ErrorNote, Field, fieldClass } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { BILLING, ratePct } from '@/lib/i18n-billing';
import { Lang, LANGS } from '@/lib/i18n';
import { useI18n } from '@/lib/lang-context';
import { splitProblem } from '@/lib/problem';
import type { Folio } from '@/lib/types';

const CATEGORIES = ['restaurant', 'bar', 'minibar', 'spa', 'laundry', 'phone', 'other'];

/** Saisie d'un montant en unités principales (« 12,50 ») convertie en centimes. */
const toMinor = (v: string) => Math.round(parseFloat(v.replace(',', '.')) * 100);

interface Props {
  reservationId: string;
  status: string;
  can: (p: string) => boolean;
}

export function FolioPanel({ reservationId, status, can }: Props) {
  const { lang, f } = useI18n();
  const b = BILLING[lang];
  const qc = useQueryClient();
  const folio = useQuery({
    queryKey: ['folio', reservationId, lang],
    queryFn: async () => (await api<Folio>(`/reservations/${reservationId}/folio`)).data,
  });
  const fm = useI18n(folio.data?.currency).f;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['folio', reservationId] });
    qc.invalidateQueries({ queryKey: ['reservation', reservationId] });
  };

  // Prestation
  const chargeDialog = useRef<HTMLDialogElement>(null);
  const [charge, setCharge] = useState({ category: 'restaurant', description: '', quantity: '1', unitPrice: '' });
  const addCharge = useMutation({
    mutationFn: () =>
      api(`/reservations/${reservationId}/folio/charges`, {
        method: 'POST',
        json: { category: charge.category, description: charge.description, quantity: Number(charge.quantity), unitAmount: toMinor(charge.unitPrice) },
      }),
    onSuccess: () => {
      chargeDialog.current?.close();
      refresh();
    },
  });
  const removeCharge = useMutation({
    mutationFn: (id: string) => api(`/reservations/${reservationId}/folio/charges/${id}`, { method: 'DELETE' }),
    onSettled: refresh,
  });

  // Encaissement : une clé d'idempotence par ouverture du formulaire
  const payDialog = useRef<HTMLDialogElement>(null);
  const payKey = useRef(newIdempotencyKey());
  const [payment, setPayment] = useState({ kind: 'payment', method: 'card', amount: '', pspReference: '', reference: '' });
  const pay = useMutation({
    mutationFn: () =>
      api(`/reservations/${reservationId}/payments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': payKey.current },
        json: {
          kind: payment.kind,
          method: payment.method,
          amount: toMinor(payment.amount),
          ...(payment.method === 'card' ? { pspReference: payment.pspReference } : {}),
          ...(payment.reference ? { reference: payment.reference } : {}),
        },
      }),
    onSuccess: () => {
      payDialog.current?.close();
      refresh();
    },
  });
  const openPay = () => {
    const bal = folio.data?.balance ?? 0;
    payKey.current = newIdempotencyKey();
    pay.reset();
    setPayment({
      kind: bal < 0 ? 'refund' : status === 'confirmed' ? 'deposit' : 'payment',
      method: 'card',
      amount: bal ? (Math.abs(bal) / 100).toFixed(2) : '',
      pspReference: '',
      reference: '',
    });
    payDialog.current?.showModal();
  };

  // Facture
  const invoiceKey = useRef(newIdempotencyKey());
  const [invoiceLang, setInvoiceLang] = useState<Lang>(lang);
  const issue = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/reservations/${reservationId}/invoice`, {
        method: 'POST',
        headers: { 'Idempotency-Key': invoiceKey.current },
        json: { lang: invoiceLang },
      }),
    onSuccess: () => {
      invoiceKey.current = newIdempotencyKey();
      refresh();
    },
  });

  if (!folio.data) return <div className="h-40 animate-pulse rounded-lg bg-line/40" aria-busy="true" />;
  const d = folio.data;
  const canWrite = can('billing:write');
  const canInvoice = canWrite && !d.locked && (status === 'checked_in' || status === 'checked_out') && d.totals.ttc > 0;
  const chargeErr = splitProblem(addCharge.error);
  const payErr = splitProblem(pay.error);

  return (
    <section aria-labelledby="billing-title" className="rounded-lg bg-surface ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id="billing-title" className="text-lg font-semibold">{b.billing}</h2>
        <div className="flex flex-wrap gap-2">
          {can('billing:charge') && !d.locked && status !== 'cancelled' && (
            <Button
              variant="secondary"
              onClick={() => {
                addCharge.reset();
                setCharge({ category: 'restaurant', description: '', quantity: '1', unitPrice: '' });
                chargeDialog.current?.showModal();
              }}
            >
              {b.addCharge}
            </Button>
          )}
          {canWrite && <Button variant={d.balance !== 0 ? 'primary' : 'secondary'} onClick={openPay}>{b.collect}</Button>}
        </div>
      </div>

      {d.locked && d.invoice && (
        <p className="border-b border-line bg-paper px-5 py-3 text-[14px]">
          <span className="font-medium">{b.invoiced(d.invoice.number)}</span>{' '}
          <Link href={`/invoices/${d.invoice.id}`} className="font-medium text-brass underline underline-offset-4">{b.viewInvoice}</Link>
          <span className="block text-ink-soft">{b.lockedHint}</span>
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="border-b border-line text-[13px] text-ink-faint">
              <th scope="col" className="px-5 py-2 text-start font-normal">{b.line}</th>
              <th scope="col" className="px-2 py-2 text-end font-normal">{b.qty}</th>
              <th scope="col" className="px-2 py-2 text-end font-normal">{b.vat}</th>
              <th scope="col" className="px-5 py-2 text-end font-normal">{b.amount}</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={l.chargeId ?? `${l.kind}-${i}`} className="border-b border-line align-top">
                <td className="px-5 py-2.5">
                  <bdi className="first-letter:uppercase">{l.description}</bdi>
                  {l.category && <span className="block text-[13px] text-ink-faint">{b.categories[l.category]}{l.postedOn ? `, ${f.shortDate(l.postedOn)}` : ''}</span>}
                </td>
                <td className="px-2 py-2.5 text-end">{l.quantity}</td>
                <td className="px-2 py-2.5 text-end text-ink-soft">{ratePct(l.vatRate, lang)}</td>
                <td className="px-5 py-2.5 text-end whitespace-nowrap">
                  {fm.amount(l.amount)}
                  {l.chargeId && !d.locked && canWrite && (
                    <button
                      onClick={() => removeCharge.mutate(l.chargeId!)}
                      className="ms-3 text-[13px] text-ink-faint underline underline-offset-2 hover:text-maintenance"
                      aria-label={b.removeCharge(l.description)}
                    >
                      {b.remove}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="space-y-1 px-5 py-4 text-[14px]">
        <div className="flex justify-between text-ink-soft"><dt>{b.totalHt}</dt><dd>{fm.amount(d.totals.ht)}</dd></div>
        {d.totals.breakdown.filter((v) => v.rate > 0).map((v) => (
          <div key={v.rate} className="flex justify-between text-ink-soft"><dt>{b.vatAt(ratePct(v.rate, lang))}</dt><dd>{fm.amount(v.vat)}</dd></div>
        ))}
        <div className="flex justify-between font-medium"><dt>{b.totalTtc}</dt><dd>{fm.amount(d.totals.ttc)}</dd></div>
        <div className="flex justify-between text-ink-soft"><dt>{b.paid}</dt><dd>{fm.amount(d.paid)}</dd></div>
        <div className={`flex items-baseline justify-between pt-2 text-lg font-semibold ${d.balance > 0 ? 'text-ink' : d.balance < 0 ? 'text-maintenance' : 'text-available'}`}>
          <dt>{d.balance > 0 ? b.balance : d.balance < 0 ? b.overpaid : b.settled}</dt>
          <dd>{fm.amount(Math.abs(d.balance))}</dd>
        </div>
      </dl>

      {d.payments.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <h3 className="mb-2 text-[14px] font-medium">{b.payments}</h3>
          <ul className="space-y-1 text-[14px]">
            {d.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>
                  {b.kinds[p.kind]}, {b.methods[p.method]}
                  {(p.pspReference || p.reference) && <span dir="ltr" className="text-ink-faint"> {p.pspReference ?? p.reference}</span>}
                  <span className="text-ink-faint"> – {f.shortDate(p.receivedAt.slice(0, 10))}</span>
                </span>
                <span className={p.amount < 0 ? 'text-maintenance' : ''}>{fm.amount(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(canInvoice || d.documents.length > 0) && (
        <div className="space-y-3 border-t border-line px-5 py-4">
          {canInvoice && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[14px]">
                <span className="block text-ink-soft">{b.invoiceLang}</span>
                <select value={invoiceLang} onChange={(e) => setInvoiceLang(e.target.value as Lang)} className="mt-1 rounded-md border border-line bg-surface px-2 py-1.5">
                  {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
              </label>
              <Button onClick={() => issue.mutate()} disabled={issue.isPending}>{b.issueInvoice}</Button>
            </div>
          )}
          <ErrorNote>{splitProblem(issue.error).message}</ErrorNote>
          {d.documents.length > 0 && (
            <div>
              <h3 className="mb-1 text-[14px] font-medium">{b.documents}</h3>
              <ul className="space-y-1 text-[14px]">
                {d.documents.map((doc) => (
                  <li key={doc.id} className="flex justify-between gap-3">
                    <Link href={`/invoices/${doc.id}`} className="text-brass underline underline-offset-4">
                      {doc.kind === 'invoice' ? b.invoice : b.creditNote} <span dir="ltr">{doc.number}</span>
                    </Link>
                    <span>{fm.amount(doc.totalTtc)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <dialog ref={chargeDialog} className="m-auto w-[min(28rem,92vw)] rounded-lg p-0 backdrop:bg-ink/40" aria-labelledby="charge-title">
        <form
          method="dialog"
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            addCharge.mutate();
          }}
        >
          <h3 id="charge-title" className="text-lg font-semibold">{b.addCharge}</h3>
          <Field label={b.category}>
            <select className={fieldClass} value={charge.category} onChange={(e) => setCharge({ ...charge, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{b.categories[c]}</option>)}
            </select>
          </Field>
          <Field label={b.description} error={chargeErr.fields.description}>
            <input className={fieldClass} required maxLength={200} value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Field label={b.qty} error={chargeErr.fields.quantity}>
              <input className={fieldClass} type="number" min={1} max={999} required value={charge.quantity} onChange={(e) => setCharge({ ...charge, quantity: e.target.value })} />
            </Field>
            <Field label={b.unitPrice} error={chargeErr.fields.unitAmount}>
              <input className={fieldClass} inputMode="decimal" required pattern="[0-9]+([.,][0-9]{1,2})?" value={charge.unitPrice} onChange={(e) => setCharge({ ...charge, unitPrice: e.target.value })} />
            </Field>
          </div>
          <ErrorNote>{chargeErr.message}</ErrorNote>
          <div className="flex gap-3">
            <Button type="submit" disabled={addCharge.isPending}>{b.add}</Button>
            <Button type="button" variant="ghost" onClick={() => chargeDialog.current?.close()}>{b.close}</Button>
          </div>
        </form>
      </dialog>

      <dialog ref={payDialog} className="m-auto w-[min(28rem,92vw)] rounded-lg p-0 backdrop:bg-ink/40" aria-labelledby="pay-title">
        <form
          method="dialog"
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            pay.mutate();
          }}
        >
          <h3 id="pay-title" className="text-lg font-semibold">{b.collect}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label={b.kind}>
              <select className={fieldClass} value={payment.kind} onChange={(e) => setPayment({ ...payment, kind: e.target.value })}>
                {(status === 'confirmed' ? ['deposit', 'refund'] : ['payment', 'refund']).map((k) => <option key={k} value={k}>{b.kinds[k]}</option>)}
              </select>
            </Field>
            <Field label={b.method}>
              <select className={fieldClass} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                {['card', 'cash', 'transfer', 'purchase_order'].map((m) => <option key={m} value={m}>{b.methods[m]}</option>)}
              </select>
            </Field>
          </div>
          <Field label={`${b.amount} (${d.currency})`} error={payErr.fields.amount}>
            <input className={fieldClass} inputMode="decimal" required pattern="[0-9]+([.,][0-9]{1,2})?" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
          </Field>
          {payment.method === 'card' && (
            <Field label={b.pspReference} hint={b.pspHint} error={payErr.fields.pspReference}>
              <input className={fieldClass} dir="ltr" required autoComplete="off" value={payment.pspReference} onChange={(e) => setPayment({ ...payment, pspReference: e.target.value })} />
            </Field>
          )}
          {(payment.method === 'transfer' || payment.method === 'purchase_order') && (
            <Field label={b.referenceHint[payment.method]} error={payErr.fields.reference}>
              <input className={fieldClass} dir="ltr" required={payment.method === 'purchase_order'} value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
            </Field>
          )}
          <ErrorNote>{payErr.message}</ErrorNote>
          <div className="flex gap-3">
            <Button type="submit" disabled={pay.isPending}>{b.record}</Button>
            <Button type="button" variant="ghost" onClick={() => payDialog.current?.close()}>{b.close}</Button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
