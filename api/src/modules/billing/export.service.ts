import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { nightsBetween } from '../../common/dates';
import { ProblemException } from '../../common/problem';
import { BillingSettingsService } from './settings.service';

interface Entry {
  date: string;
  journal: 'VE' | 'BQ' | 'CA' | 'OD';
  piece: string;
  account: string;
  label: string;
  /** Montant signé en unités mineures : positif au débit, négatif au crédit. */
  amount: number;
}

const money = (minor: number) => (Math.abs(minor) / 100).toFixed(2).replace('.', ',');
const csvCell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Export des écritures (section 3.5) au format CSV « ; » — journaux ventes, banque, caisse et opérations diverses. */
@Injectable()
export class AccountingExportService {
  constructor(@InjectDataSource() private readonly ds: DataSource, private readonly settings: BillingSettingsService) {}

  async entries(from: string, to: string): Promise<Entry[]> {
    const days = nightsBetween(from, to);
    if (!Number.isFinite(days) || days < 1 || days > 366) {
      throw new ProblemException(422, 'VALIDATION_FAILED', 'Période de 1 à 366 jours.');
    }
    const { accounts: a } = await this.settings.get();
    const out: Entry[] = [];

    const invoices = await this.ds.query(
      `SELECT i.id, i.number, to_char(i.issue_date,'YYYY-MM-DD') AS date, i.customer->>'name' AS customer, i.total_ttc, i.total_vat
       FROM invoices i WHERE i.issue_date >= $1 AND i.issue_date < $2 ORDER BY i.seq`,
      [from, to],
    );
    for (const inv of invoices) {
      const label = `${inv.number} ${inv.customer}`;
      out.push({ date: inv.date, journal: 'VE', piece: inv.number, account: a.customers, label, amount: inv.total_ttc });
      const byKind = await this.ds.query(
        `SELECT kind, sum(ht_amount)::int AS ht FROM invoice_lines WHERE invoice_id = $1 GROUP BY kind ORDER BY kind`,
        [inv.id],
      );
      for (const k of byKind) {
        const account = k.kind === 'stay' ? a.accommodation : k.kind === 'tourist_tax' ? a.touristTax : a.extras;
        out.push({ date: inv.date, journal: 'VE', piece: inv.number, account, label, amount: -k.ht });
      }
      if (inv.total_vat !== 0) out.push({ date: inv.date, journal: 'VE', piece: inv.number, account: a.vat, label, amount: -inv.total_vat });
    }

    const payments = await this.ds.query(
      `SELECT p.id, p.method, p.kind, p.amount, to_char(p.received_at AT TIME ZONE $3,'YYYY-MM-DD') AS date, r.reference
       FROM payments p JOIN reservations r ON r.id = p.reservation_id
       WHERE (p.received_at AT TIME ZONE $3)::date >= $1 AND (p.received_at AT TIME ZONE $3)::date < $2
       ORDER BY p.received_at`,
      [from, to, process.env.HOTEL_TZ ?? 'Europe/Paris'],
    );
    for (const pay of payments) {
      const piece = `P-${pay.id.slice(0, 8).toUpperCase()}`;
      const label = `${pay.kind === 'refund' ? 'Remboursement' : pay.kind === 'deposit' ? 'Acompte' : 'Règlement'} ${pay.reference}`;
      const [journal, debitAccount] =
        pay.method === 'cash' ? (['CA', a.cash] as const)
          : pay.method === 'card' ? (['BQ', a.cards] as const)
            : pay.method === 'transfer' ? (['BQ', a.bank] as const)
              : (['OD', a.customersDeferred] as const);
      out.push({ date: pay.date, journal, piece, account: debitAccount, label, amount: pay.amount });
      out.push({ date: pay.date, journal, piece, account: a.customers, label, amount: -pay.amount });
    }
    return out;
  }

  async csv(from: string, to: string): Promise<string> {
    const rows = await this.entries(from, to);
    const lines = ['date;journal;piece;compte;libelle;debit;credit'];
    for (const e of rows) {
      lines.push(
        [e.date, e.journal, e.piece, e.account, csvCell(e.label), e.amount > 0 ? money(e.amount) : '', e.amount < 0 ? money(e.amount) : ''].join(';'),
      );
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }
}
