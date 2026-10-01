import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/auth.decorators';
import { hotelToday } from '../../common/dates';
import { Lang } from '../../common/i18n';
import { appConfig } from '../../config';
import { invalidState, notFound, ProblemException } from '../../common/problem';
import { ListInvoicesQuery } from './billing.dto';
import { returnedRows, sha256, stableStringify } from './billing.util';
import { FolioLine, FolioService, totalsOf } from './folio.service';
import { BillingSettingsService } from './settings.service';

interface InvoiceRow {
  id: string;
  seq: string;
  number: string;
  series: string;
  kind: 'invoice' | 'credit_note';
  reservation_id: string;
  credited_invoice_id: string | null;
  issued_at: Date;
  issue_date: string;
  lang: Lang;
  currency: string;
  customer: Record<string, unknown>;
  seller: Record<string, unknown>;
  total_ttc: number;
  total_ht: number;
  total_vat: number;
  vat_breakdown: unknown;
  reason: string | null;
  previous_hash: string | null;
  hash: string;
}

type StoredLine = Omit<FolioLine, 'chargeId' | 'category' | 'postedOn'> & { position: number };

/** Contenu scellé d'une pièce : toute modification ultérieure change l'empreinte. */
function sealOf(inv: Omit<InvoiceRow, 'id' | 'seq' | 'hash'>, lines: StoredLine[]) {
  const content = {
    number: inv.number,
    series: inv.series,
    kind: inv.kind,
    reservationId: inv.reservation_id,
    creditedInvoiceId: inv.credited_invoice_id,
    issuedAt: new Date(inv.issued_at).toISOString(),
    issueDate: inv.issue_date,
    lang: inv.lang,
    currency: inv.currency.trim(),
    customer: inv.customer,
    seller: inv.seller,
    totals: [inv.total_ttc, inv.total_ht, inv.total_vat],
    reason: inv.reason,
    lines: lines.map((l) => [l.position, l.kind, l.description, l.quantity, l.unitAmount, l.amount, l.vatRate, l.vatAmount, l.htAmount]),
  };
  return sha256(`${inv.previous_hash ?? 'GENESIS'}|${stableStringify(content)}`);
}

const SELECT_INVOICE = `
  SELECT id, seq, number, series, kind, reservation_id, credited_invoice_id, issued_at,
         to_char(issue_date,'YYYY-MM-DD') AS issue_date, lang, trim(currency) AS currency, customer, seller,
         total_ttc, total_ht, total_vat, vat_breakdown, reason, previous_hash, hash
  FROM invoices`;

@Injectable()
export class InvoicesService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly folio: FolioService,
    private readonly settings: BillingSettingsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Émission sérialisée : un verrou transactionnel garantit une numérotation continue
   * (un échec annule aussi l'incrément du compteur) et un chaînage sans bifurcation.
   */
  private async lockChain(m: EntityManager) {
    await m.query(`SELECT pg_advisory_xact_lock(hashtext('invoice-chain'))`);
  }

  private async nextNumber(m: EntityManager, prefix: 'F' | 'A', date: string) {
    const series = `${prefix}${date.slice(0, 4)}`;
    await m.query(`INSERT INTO invoice_counters (series, last_number) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [series]);
    const [{ last_number }] = returnedRows<{ last_number: number }>(
      await m.query(`UPDATE invoice_counters SET last_number = last_number + 1 WHERE series = $1 RETURNING last_number`, [series]),
    );
    return { series, number: `${series}-${String(last_number).padStart(6, '0')}` };
  }

  private async insert(m: EntityManager, inv: Omit<InvoiceRow, 'id' | 'seq' | 'hash' | 'previous_hash'>, lines: StoredLine[], actor: AuthUser) {
    const [last] = await m.query(`SELECT hash FROM invoices ORDER BY seq DESC LIMIT 1`);
    const row = { ...inv, previous_hash: last?.hash ?? null };
    const hash = sealOf(row, lines);
    const [{ id }] = await m.query(
      `INSERT INTO invoices (number, series, kind, reservation_id, credited_invoice_id, issued_at, issue_date, lang, currency,
         customer, seller, total_ttc, total_ht, total_vat, vat_breakdown, reason, previous_hash, hash, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [
        row.number, row.series, row.kind, row.reservation_id, row.credited_invoice_id, row.issued_at, row.issue_date, row.lang, row.currency,
        JSON.stringify(row.customer), JSON.stringify(row.seller), row.total_ttc, row.total_ht, row.total_vat,
        JSON.stringify(row.vat_breakdown), row.reason, row.previous_hash, hash, actor.id,
      ],
    );
    for (const l of lines) {
      await m.query(
        `INSERT INTO invoice_lines (invoice_id, position, kind, description, quantity, unit_amount, amount, vat_rate, vat_amount, ht_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, l.position, l.kind, l.description, l.quantity, l.unitAmount, l.amount, l.vatRate, l.vatAmount, l.htAmount],
      );
    }
    return id as string;
  }

  async issue(reservationId: string, lang: Lang, actor: AuthUser) {
    const id = await this.ds.transaction(async (m) => {
      await this.lockChain(m);
      const [r] = await m.query(
        `SELECT r.id, r.status, g.first_name, g.last_name, g.email, g.phone, g.nationality, r.reference
         FROM reservations r JOIN guests g ON g.id = r.guest_id WHERE r.id = $1 FOR UPDATE OF r`,
        [reservationId],
      );
      if (!r) throw notFound('Réservation');
      if (!['checked_in', 'checked_out'].includes(r.status)) {
        throw invalidState('La facture s’émet pendant ou après le séjour (client arrivé ou parti).');
      }
      await this.folio.assertNotInvoiced(m, reservationId);
      const computed = await this.folio.computeLines(m, reservationId, lang);
      const lines: StoredLine[] = computed.map(({ chargeId: _c, category: _k, postedOn: _p, ...l }, i) => ({ ...l, position: i + 1 }));
      const totals = totalsOf(lines);
      if (totals.ttc <= 0) throw invalidState('Rien à facturer pour ce séjour.');
      const s = await this.settings.get(m);
      const issueDate = hotelToday();
      const { series, number } = await this.nextNumber(m, 'F', issueDate);
      const newId = await this.insert(
        m,
        {
          number, series, kind: 'invoice', reservation_id: reservationId, credited_invoice_id: null,
          issued_at: new Date(), issue_date: issueDate, lang, currency: appConfig.hotel.currency,
          customer: { name: `${r.first_name} ${r.last_name}`, email: r.email, phone: r.phone, country: r.nationality, reservation: r.reference },
          seller: { ...s.seller, country: s.country },
          total_ttc: totals.ttc, total_ht: totals.ht, total_vat: totals.vat, vat_breakdown: totals.breakdown, reason: null,
        },
        lines,
        actor,
      );
      await this.audit.log({ actorId: actor.id, action: 'invoice.issued', entityType: 'reservation', entityId: reservationId, data: { invoiceId: newId, number, totalTtc: totals.ttc } }, m);
      return newId;
    });
    return this.get(id);
  }

  /** Avoir total : annule une facture sans la modifier et rouvre le compte du séjour. */
  async creditNote(invoiceId: string, reason: string, actor: AuthUser) {
    const id = await this.ds.transaction(async (m) => {
      await this.lockChain(m);
      const [orig]: InvoiceRow[] = await m.query(`${SELECT_INVOICE} WHERE id = $1`, [invoiceId]);
      if (!orig) throw notFound('Facture');
      if (orig.kind !== 'invoice') throw invalidState('Un avoir ne peut pas lui-même faire l’objet d’un avoir.');
      const [already] = await m.query(`SELECT number FROM invoices WHERE credited_invoice_id = $1`, [invoiceId]);
      if (already) throw invalidState(`Facture déjà annulée par l’avoir ${already.number}.`);
      const origLines = await this.lines(m, invoiceId);
      const lines: StoredLine[] = origLines.map((l) => ({
        ...l, unitAmount: -l.unitAmount, amount: -l.amount, vatAmount: -l.vatAmount, htAmount: -l.htAmount,
      }));
      const totals = totalsOf(lines);
      const issueDate = hotelToday();
      const { series, number } = await this.nextNumber(m, 'A', issueDate);
      const newId = await this.insert(
        m,
        {
          number, series, kind: 'credit_note', reservation_id: orig.reservation_id, credited_invoice_id: orig.id,
          issued_at: new Date(), issue_date: issueDate, lang: orig.lang, currency: orig.currency,
          customer: orig.customer, seller: orig.seller,
          total_ttc: totals.ttc, total_ht: totals.ht, total_vat: totals.vat, vat_breakdown: totals.breakdown, reason,
        },
        lines,
        actor,
      );
      await this.audit.log(
        { actorId: actor.id, action: 'invoice.credited', entityType: 'reservation', entityId: orig.reservation_id, data: { invoiceId, creditNoteId: newId, number, reason } },
        m,
      );
      return newId;
    });
    return this.get(id);
  }

  private async lines(m: EntityManager, invoiceId: string): Promise<StoredLine[]> {
    const rows = await m.query(`SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY position`, [invoiceId]);
    return rows.map((l: Record<string, string | number>) => ({
      position: l.position, kind: l.kind, description: l.description, quantity: l.quantity, unitAmount: l.unit_amount,
      amount: l.amount, vatRate: l.vat_rate, vatAmount: l.vat_amount, htAmount: l.ht_amount,
    }));
  }

  private toDto(i: InvoiceRow, lines?: StoredLine[], extra: Record<string, unknown> = {}) {
    return {
      id: i.id, number: i.number, kind: i.kind, reservationId: i.reservation_id, creditedInvoiceId: i.credited_invoice_id,
      issuedAt: i.issued_at, issueDate: i.issue_date, lang: i.lang, currency: i.currency,
      customer: i.customer, seller: i.seller,
      totals: { ttc: i.total_ttc, ht: i.total_ht, vat: i.total_vat, breakdown: i.vat_breakdown },
      reason: i.reason, hash: i.hash, ...(lines ? { lines } : {}), ...extra,
    };
  }

  async get(id: string) {
    const [inv]: InvoiceRow[] = await this.ds.query(`${SELECT_INVOICE} WHERE id = $1`, [id]);
    if (!inv) throw notFound('Facture');
    const lines = await this.lines(this.ds.manager, id);
    const [credit] = await this.ds.query(`SELECT id, number FROM invoices WHERE credited_invoice_id = $1`, [id]);
    const [credited] = inv.credited_invoice_id ? await this.ds.query(`SELECT number FROM invoices WHERE id = $1`, [inv.credited_invoice_id]) : [];
    return this.toDto(inv, lines, { creditNote: credit ?? null, creditedInvoiceNumber: credited?.number ?? null });
  }

  async list(q: ListInvoicesQuery) {
    const limit = q.limit ?? 50;
    const params: unknown[] = [];
    const where: string[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (q.from) where.push(`issue_date >= ${p(q.from)}`);
    if (q.to) where.push(`issue_date <= ${p(q.to)}`);
    if (q.kind) where.push(`kind = ${p(q.kind)}`);
    if (q.q) {
      const like = `%${q.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push(`(lower(number) LIKE ${p(like)} OR lower(customer->>'name') LIKE $${params.length})`);
    }
    if (q.cursor) {
      const seq = Number(Buffer.from(q.cursor, 'base64url').toString());
      if (!Number.isInteger(seq)) throw new ProblemException(400, 'BAD_REQUEST', 'Curseur invalide.');
      where.push(`seq < ${p(seq)}`);
    }
    const rows: InvoiceRow[] = await this.ds.query(
      `${SELECT_INVOICE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY seq DESC LIMIT ${p(limit + 1)}`,
      params,
    );
    const more = rows.length > limit;
    if (more) rows.pop();
    return {
      data: rows.map((r) => this.toDto(r)),
      nextCursor: more ? Buffer.from(String(rows[rows.length - 1].seq)).toString('base64url') : null,
    };
  }

  /** Contrôle d'intégrité : empreintes recalculées, chaînage et numérotation continue par série. */
  async verify() {
    const rows: InvoiceRow[] = await this.ds.query(`${SELECT_INVOICE} ORDER BY seq`);
    const errors: { number: string; problem: string }[] = [];
    let previous: string | null = null;
    const lastBySeries = new Map<string, number>();
    for (const inv of rows) {
      if (inv.previous_hash !== previous) errors.push({ number: inv.number, problem: 'chaînage rompu (empreinte précédente différente)' });
      const lines = await this.lines(this.ds.manager, inv.id);
      if (sealOf(inv, lines) !== inv.hash) errors.push({ number: inv.number, problem: 'contenu modifié (empreinte invalide)' });
      const n = Number(inv.number.split('-')[1]);
      const expected = (lastBySeries.get(inv.series) ?? 0) + 1;
      if (n !== expected) errors.push({ number: inv.number, problem: `numérotation discontinue (attendu ${expected})` });
      lastBySeries.set(inv.series, n);
      previous = inv.hash;
    }
    return { valid: errors.length === 0, checked: rows.length, lastHash: previous, errors };
  }
}
