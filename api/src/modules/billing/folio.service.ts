import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/auth.decorators';
import { hotelToday, nightsBetween } from '../../common/dates';
import { Lang } from '../../common/i18n';
import { invalidState, notFound, ProblemException } from '../../common/problem';
import { ChargeCategory, ChargeDto, PaymentDto } from './billing.dto';
import { LINE_TEXT, looksLikeCardNumber, returnedRows, vatOf } from './billing.util';
import { BillingSettings, BillingSettingsService } from './settings.service';

export interface FolioLine {
  kind: 'stay' | 'tourist_tax' | 'charge';
  chargeId?: string;
  category?: string;
  postedOn?: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  vatRate: number;
  vatAmount: number;
  htAmount: number;
}

export interface Totals {
  ttc: number;
  ht: number;
  vat: number;
  breakdown: { rate: number; base: number; vat: number }[];
}

const CATEGORY_VAT: Record<ChargeCategory, keyof BillingSettings['vat']> = {
  restaurant: 'food', bar: 'extras', minibar: 'extras', spa: 'extras', laundry: 'extras', phone: 'extras', other: 'extras',
};

const withVat = (l: Omit<FolioLine, 'vatAmount' | 'htAmount'>): FolioLine => {
  const vatAmount = vatOf(l.amount, l.vatRate);
  return { ...l, vatAmount, htAmount: l.amount - vatAmount };
};

export function totalsOf(lines: Pick<FolioLine, 'amount' | 'vatRate' | 'vatAmount' | 'htAmount'>[]): Totals {
  const byRate = new Map<number, { rate: number; base: number; vat: number }>();
  for (const l of lines) {
    const r = byRate.get(l.vatRate) ?? { rate: l.vatRate, base: 0, vat: 0 };
    r.base += l.htAmount;
    r.vat += l.vatAmount;
    byRate.set(l.vatRate, r);
  }
  return {
    ttc: lines.reduce((s, l) => s + l.amount, 0),
    ht: lines.reduce((s, l) => s + l.htAmount, 0),
    vat: lines.reduce((s, l) => s + l.vatAmount, 0),
    breakdown: [...byRate.values()].sort((a, b) => a.rate - b.rate),
  };
}

interface ResRow {
  id: string;
  status: string;
  arrival_date: string;
  departure_date: string;
  adults: number;
  board: string;
  total_amount: number;
  currency: string;
  room_type_name: string;
}

@Injectable()
export class FolioService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly settings: BillingSettingsService,
    private readonly audit: AuditService,
  ) {}

  private async reservation(m: EntityManager, id: string, lock = false): Promise<ResRow> {
    if (lock) await m.query(`SELECT id FROM reservations WHERE id = $1 FOR UPDATE`, [id]);
    const [r] = await m.query(
      `SELECT r.id, r.status, to_char(r.arrival_date,'YYYY-MM-DD') AS arrival_date, to_char(r.departure_date,'YYYY-MM-DD') AS departure_date,
              r.adults, r.board, r.total_amount, trim(r.currency) AS currency, rt.name AS room_type_name
       FROM reservations r JOIN room_types rt ON rt.id = r.room_type_id WHERE r.id = $1`,
      [id],
    );
    if (!r) throw notFound('Réservation');
    return r;
  }

  /** Facture en vigueur (émise et non annulée par un avoir) : elle fige le compte du séjour. */
  async activeInvoice(m: EntityManager, reservationId: string): Promise<{ id: string; number: string; issued_at: Date } | null> {
    const [inv] = await m.query(
      `SELECT i.id, i.number, i.issued_at FROM invoices i
       WHERE i.reservation_id = $1 AND i.kind = 'invoice'
         AND NOT EXISTS (SELECT 1 FROM invoices c WHERE c.credited_invoice_id = i.id)`,
      [reservationId],
    );
    return inv ?? null;
  }

  async assertNotInvoiced(m: EntityManager, reservationId: string) {
    const inv = await this.activeInvoice(m, reservationId);
    if (inv) {
      throw new ProblemException(409, 'INVOICE_LOCKED', `Séjour facturé (${inv.number}) : émettez un avoir avant toute modification.`);
    }
  }

  /** Lignes facturables calculées : séjour, taxe de séjour, prestations portées au compte. */
  async computeLines(m: EntityManager, reservationId: string, lang: Lang): Promise<FolioLine[]> {
    const r = await this.reservation(m, reservationId);
    const s = await this.settings.get(m);
    const lines: FolioLine[] = [];
    if (['confirmed', 'checked_in', 'checked_out'].includes(r.status)) {
      const nights = nightsBetween(r.arrival_date, r.departure_date);
      lines.push(withVat({
        kind: 'stay',
        description: LINE_TEXT[lang].stay(r.room_type_name, nights, r.board, r.arrival_date, r.departure_date),
        quantity: 1,
        unitAmount: r.total_amount,
        amount: r.total_amount,
        vatRate: s.vat.accommodation,
      }));
      const tax = s.touristTax.perAdultPerNight * r.adults * nights;
      if (tax > 0) {
        lines.push(withVat({
          kind: 'tourist_tax',
          description: LINE_TEXT[lang].touristTax(r.adults, nights),
          quantity: r.adults * nights,
          unitAmount: s.touristTax.perAdultPerNight,
          amount: tax,
          vatRate: 0,
        }));
      }
    }
    const charges = await m.query(
      `SELECT id, category, description, quantity, unit_amount, vat_rate, to_char(posted_on,'YYYY-MM-DD') AS posted_on
       FROM folio_charges WHERE reservation_id = $1 ORDER BY posted_on, created_at`,
      [reservationId],
    );
    for (const c of charges) {
      lines.push(withVat({
        kind: 'charge',
        chargeId: c.id,
        category: c.category,
        postedOn: c.posted_on,
        description: c.description,
        quantity: c.quantity,
        unitAmount: c.unit_amount,
        amount: c.quantity * c.unit_amount,
        vatRate: c.vat_rate,
      }));
    }
    return lines;
  }

  async paymentsOf(m: EntityManager, reservationId: string) {
    const rows = await m.query(
      `SELECT id, kind, method, amount, psp_reference, reference, received_at FROM payments WHERE reservation_id = $1 ORDER BY received_at`,
      [reservationId],
    );
    return rows.map((p: Record<string, unknown>) => ({
      id: p.id, kind: p.kind, method: p.method, amount: p.amount,
      pspReference: p.psp_reference, reference: p.reference, receivedAt: p.received_at,
    })) as { id: string; kind: string; method: string; amount: number; pspReference: string | null; reference: string | null; receivedAt: Date }[];
  }

  /** Compte du séjour : lignes (figées si facturé), encaissements et solde. */
  async folio(reservationId: string, lang: Lang, m: EntityManager = this.ds.manager) {
    const r = await this.reservation(m, reservationId);
    const active = await this.activeInvoice(m, reservationId);
    let lines: FolioLine[];
    if (active) {
      const rows = await m.query(
        `SELECT kind, description, quantity, unit_amount, amount, vat_rate, vat_amount, ht_amount FROM invoice_lines WHERE invoice_id = $1 ORDER BY position`,
        [active.id],
      );
      lines = rows.map((l: Record<string, number | string>) => ({
        kind: l.kind, description: l.description, quantity: l.quantity, unitAmount: l.unit_amount, amount: l.amount,
        vatRate: l.vat_rate, vatAmount: l.vat_amount, htAmount: l.ht_amount,
      }));
    } else {
      lines = await this.computeLines(m, reservationId, lang);
    }
    const payments = await this.paymentsOf(m, reservationId);
    const totals = totalsOf(lines);
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const documents = await m.query(
      `SELECT id, number, kind, issued_at AS "issuedAt", total_ttc AS "totalTtc", credited_invoice_id AS "creditedInvoiceId"
       FROM invoices WHERE reservation_id = $1 ORDER BY seq`,
      [reservationId],
    );
    return {
      reservationId,
      currency: r.currency,
      locked: !!active,
      invoice: active ? { id: active.id, number: active.number, issuedAt: active.issued_at } : null,
      lines,
      totals,
      payments,
      paid,
      balance: totals.ttc - paid,
      documents,
    };
  }

  async addCharge(reservationId: string, dto: ChargeDto, actor: AuthUser, lang: Lang = 'fr') {
    await this.ds.transaction(async (m) => {
      const r = await this.reservation(m, reservationId, true);
      if (!['confirmed', 'checked_in', 'checked_out'].includes(r.status)) {
        throw invalidState(`Réservation au statut ${r.status} : aucune prestation ne peut y être portée.`);
      }
      await this.assertNotInvoiced(m, reservationId);
      const s = await this.settings.get(m);
      const vatRate = dto.vatRate ?? s.vat[CATEGORY_VAT[dto.category]];
      const [{ id }] = await m.query(
        `INSERT INTO folio_charges (reservation_id, category, description, quantity, unit_amount, vat_rate, posted_on, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [reservationId, dto.category, dto.description, dto.quantity ?? 1, dto.unitAmount, vatRate, hotelToday(), actor.id],
      );
      await this.audit.log(
        { actorId: actor.id, action: 'folio.charge_added', entityType: 'reservation', entityId: reservationId, data: { chargeId: id, ...dto, vatRate } },
        m,
      );
    });
    return this.folio(reservationId, lang);
  }

  /** Facturation à la chambre (section 3.7) : la consommation va au séjour en cours dans cette chambre. */
  async chargeRoom(roomId: string, dto: ChargeDto, actor: AuthUser) {
    const [res] = await this.ds.query(
      `SELECT r.id, rm.number FROM reservations r JOIN rooms rm ON rm.id = r.room_id WHERE r.room_id = $1 AND r.status = 'checked_in'`,
      [roomId],
    );
    if (!res) {
      const [room] = await this.ds.query(`SELECT number FROM rooms WHERE id = $1`, [roomId]);
      if (!room) throw notFound('Chambre');
      throw invalidState(`Aucun client présent en chambre ${room.number}.`);
    }
    await this.addCharge(res.id, dto, actor);
    return { reservationId: res.id, roomNumber: res.number };
  }

  async deleteCharge(reservationId: string, chargeId: string, actor: AuthUser, lang: Lang = 'fr') {
    await this.ds.transaction(async (m) => {
      await this.reservation(m, reservationId, true);
      await this.assertNotInvoiced(m, reservationId);
      const [c] = returnedRows<Record<string, unknown>>(
        await m.query(`DELETE FROM folio_charges WHERE id = $1 AND reservation_id = $2 RETURNING description, quantity, unit_amount`, [
          chargeId,
          reservationId,
        ]),
      );
      if (!c) throw notFound('Prestation');
      await this.audit.log(
        { actorId: actor.id, action: 'folio.charge_removed', entityType: 'reservation', entityId: reservationId, data: { chargeId, ...c } },
        m,
      );
    });
    return this.folio(reservationId, lang);
  }

  async addPayment(reservationId: string, dto: PaymentDto, actor: AuthUser, lang: Lang = 'fr') {
    if (dto.method === 'card' && !dto.pspReference) {
      throw new ProblemException(422, 'VALIDATION_FAILED', 'Carte : la référence de transaction du terminal ou du prestataire est obligatoire.');
    }
    for (const text of [dto.pspReference, dto.reference]) {
      if (text && looksLikeCardNumber(text)) {
        throw new ProblemException(422, 'VALIDATION_FAILED', 'Ne saisissez jamais un numéro de carte : indiquez la référence de transaction.');
      }
    }
    if (dto.method === 'purchase_order' && !dto.reference) {
      throw new ProblemException(422, 'VALIDATION_FAILED', 'Bon de commande : le numéro du bon est obligatoire.');
    }
    await this.ds.transaction(async (m) => {
      const r = await this.reservation(m, reservationId, true);
      const amount = dto.kind === 'refund' ? -dto.amount : dto.amount;
      if (dto.kind === 'refund') {
        const [{ paid }] = await m.query(`SELECT coalesce(sum(amount),0)::int AS paid FROM payments WHERE reservation_id = $1`, [reservationId]);
        if (dto.amount > paid) {
          throw new ProblemException(422, 'VALIDATION_FAILED', `Remboursement supérieur aux sommes encaissées (${paid / 100} ${r.currency}).`);
        }
      }
      if (dto.kind === 'deposit' && r.status !== 'confirmed') {
        throw invalidState('Un acompte s’encaisse avant l’arrivée ; enregistrez un paiement.');
      }
      const [{ id }] = await m.query(
        `INSERT INTO payments (reservation_id, kind, method, amount, psp_reference, reference, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [reservationId, dto.kind, dto.method, amount, dto.pspReference ?? null, dto.reference ?? null, actor.id],
      );
      await this.audit.log(
        { actorId: actor.id, action: 'payment.recorded', entityType: 'reservation', entityId: reservationId, data: { paymentId: id, kind: dto.kind, method: dto.method, amount } },
        m,
      );
    });
    return this.folio(reservationId, lang);
  }
}
