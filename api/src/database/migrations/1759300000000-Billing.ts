import { MigrationInterface, QueryRunner } from 'typeorm';

/** Valeurs par défaut à adapter au pays d'exploitation (section 3.5). Taux en points de base : 1000 = 10 %. */
export const DEFAULT_BILLING_SETTINGS = {
  country: null as string | null,
  vat: { accommodation: 1000, food: 1000, extras: 2000 },
  touristTax: { perAdultPerNight: 150 },
  seller: {
    legalName: 'Raison sociale à compléter',
    address: '',
    taxId: '',
    registration: '',
    footer: '',
  },
  accounts: {
    customers: '411000',
    customersDeferred: '411100',
    accommodation: '706100',
    extras: '706200',
    touristTax: '467000',
    vat: '445710',
    bank: '512000',
    cash: '530000',
    cards: '511200',
  },
};

export class Billing1759300000000 implements MigrationInterface {
  name = 'Billing1759300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        version int NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`INSERT INTO settings (key, value) VALUES ('billing', $1)`, [JSON.stringify(DEFAULT_BILLING_SETTINGS)]);

    await q.query(`
      CREATE TABLE folio_charges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reservation_id uuid NOT NULL REFERENCES reservations(id),
        category text NOT NULL CHECK (category IN ('restaurant','bar','minibar','spa','laundry','phone','other')),
        description text NOT NULL,
        quantity int NOT NULL CHECK (quantity > 0),
        unit_amount int NOT NULL CHECK (unit_amount >= 0),
        vat_rate int NOT NULL CHECK (vat_rate BETWEEN 0 AND 10000),
        posted_on date NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX folio_charges_reservation_idx ON folio_charges (reservation_id)`);

    await q.query(`
      CREATE TABLE payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reservation_id uuid NOT NULL REFERENCES reservations(id),
        kind text NOT NULL CHECK (kind IN ('deposit','payment','refund')),
        method text NOT NULL CHECK (method IN ('cash','card','transfer','purchase_order')),
        amount int NOT NULL CHECK (amount <> 0),
        psp_reference text,
        reference text,
        received_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid,
        -- Carte : seule la référence de transaction du prestataire est conservée (PCI DSS).
        CONSTRAINT payments_card_reference_chk CHECK (method <> 'card' OR psp_reference IS NOT NULL),
        CONSTRAINT payments_refund_sign_chk CHECK ((kind = 'refund') = (amount < 0))
      )`);
    await q.query(`CREATE INDEX payments_reservation_idx ON payments (reservation_id)`);
    await q.query(`CREATE INDEX payments_received_idx ON payments (received_at)`);

    await q.query(`CREATE TABLE invoice_counters (series text PRIMARY KEY, last_number int NOT NULL)`);

    await q.query(`
      CREATE TABLE invoices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        seq bigserial UNIQUE,
        number text NOT NULL UNIQUE,
        series text NOT NULL,
        kind text NOT NULL CHECK (kind IN ('invoice','credit_note')),
        reservation_id uuid NOT NULL REFERENCES reservations(id),
        credited_invoice_id uuid UNIQUE REFERENCES invoices(id),
        issued_at timestamptz NOT NULL,
        issue_date date NOT NULL,
        lang text NOT NULL CHECK (lang IN ('fr','en','ar')),
        currency char(3) NOT NULL,
        customer jsonb NOT NULL,
        seller jsonb NOT NULL,
        total_ttc int NOT NULL,
        total_ht int NOT NULL,
        total_vat int NOT NULL,
        vat_breakdown jsonb NOT NULL,
        reason text,
        previous_hash text,
        hash text NOT NULL,
        created_by uuid,
        CONSTRAINT invoices_credit_note_chk CHECK ((kind = 'credit_note') = (credited_invoice_id IS NOT NULL))
      )`);
    await q.query(`CREATE INDEX invoices_reservation_idx ON invoices (reservation_id)`);
    await q.query(`CREATE INDEX invoices_issue_date_idx ON invoices (issue_date, seq)`);

    await q.query(`
      CREATE TABLE invoice_lines (
        invoice_id uuid NOT NULL REFERENCES invoices(id),
        position int NOT NULL,
        kind text NOT NULL,
        description text NOT NULL,
        quantity int NOT NULL,
        unit_amount int NOT NULL,
        amount int NOT NULL,
        vat_rate int NOT NULL,
        vat_amount int NOT NULL,
        ht_amount int NOT NULL,
        PRIMARY KEY (invoice_id, position)
      )`);

    // Inaltérabilité : les pièces émises et les encaissements ne se modifient ni ne se suppriment.
    await q.query(`
      CREATE FUNCTION forbid_modification() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Table % : enregistrement inaltérable (émettre un avoir ou un remboursement)', TG_TABLE_NAME
          USING ERRCODE = 'P0001';
      END $$ LANGUAGE plpgsql`);
    for (const t of ['invoices', 'invoice_lines', 'payments']) {
      await q.query(`CREATE TRIGGER ${t}_immutable BEFORE UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION forbid_modification()`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of ['invoices', 'invoice_lines', 'payments']) await q.query(`DROP TRIGGER IF EXISTS ${t}_immutable ON ${t}`);
    await q.query(`DROP FUNCTION IF EXISTS forbid_modification()`);
    for (const t of ['invoice_lines', 'invoices', 'invoice_counters', 'payments', 'folio_charges', 'settings']) {
      await q.query(`DROP TABLE IF EXISTS ${t}`);
    }
  }
}
