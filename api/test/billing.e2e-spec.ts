import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, hotelToday } from '../src/common/dates';
import { createTestApp, login, loginWithMfa } from './helpers';

let app: INestApplication;
let ds: DataSource;
let reception: string;
let restaurant: string;
let housekeeping: string;
let accounting: string;
let admin: string;
let types: Record<string, string>;
const T = hotelToday();
const YEAR = T.slice(0, 4);
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let seq = 0;
const key = () => `bill-${++seq}`;

async function bookAndCheckIn(type: string, nights: number, adults: number, board = 'room_only') {
  const res = await http()
    .post('/v1/reservations')
    .set(auth(reception))
    .set('Idempotency-Key', key())
    .send({
      guest: { firstName: 'Client', lastName: `Facture${seq}`, email: `c${seq}@example.com` },
      roomTypeId: types[type], arrivalDate: T, departureDate: addDays(T, nights), adults, board, channel: 'direct',
    })
    .expect(201);
  const cin = await http().post(`/v1/reservations/${res.body.id}/check-in`).set(auth(reception)).send({}).expect(200);
  return { id: res.body.id as string, roomId: cin.body.room.id as string };
}
const folio = (id: string, token = reception) => http().get(`/v1/reservations/${id}/folio`).set(auth(token));
const pay = (id: string, body: Record<string, unknown>, token = reception) =>
  http().post(`/v1/reservations/${id}/payments`).set(auth(token)).set('Idempotency-Key', key()).send(body);

let main: { id: string; roomId: string };
let firstInvoice: { id: string; number: string };

beforeAll(async () => {
  ({ app, ds } = await createTestApp());
  reception = (await login(app, 'reception@hotel.local')).accessToken;
  restaurant = (await login(app, 'restaurant@hotel.local')).accessToken;
  housekeeping = (await login(app, 'menage@hotel.local')).accessToken;
  accounting = await loginWithMfa(app, 'compta@hotel.local');
  admin = await loginWithMfa(app, 'admin@hotel.local');
  types = Object.fromEntries((await ds.query('SELECT id, code FROM room_types')).map((r: { id: string; code: string }) => [r.code, r.id]));
  // Chambre double, 2 nuits, demi-pension, 2 adultes : 2 × (9 500 + 2 × 2 500) = 29 000
  main = await bookAndCheckIn('DBL', 2, 2, 'half_board');
});

afterAll(() => app.close());

describe('Compte du séjour', () => {
  it('séjour TVA 10 % incluse et taxe de séjour par adulte et par nuit', async () => {
    const res = await folio(main.id).expect(200);
    expect(res.body.lines).toHaveLength(2);
    expect(res.body.lines[0]).toMatchObject({ kind: 'stay', amount: 29000, vatRate: 1000, vatAmount: 2636, htAmount: 26364 });
    expect(res.body.lines[0].description).toContain('2 nuits');
    expect(res.body.lines[1]).toMatchObject({ kind: 'tourist_tax', amount: 600, vatRate: 0, quantity: 4 });
    expect(res.body).toMatchObject({ locked: false, balance: 29600, totals: { ttc: 29600, ht: 26964, vat: 2636 } });
  });

  it('le restaurant facture à la chambre sans voir le compte ; TVA selon la catégorie', async () => {
    const r = await http()
      .post(`/v1/rooms/${main.roomId}/charges`)
      .set(auth(restaurant))
      .send({ category: 'restaurant', description: 'Dîner – menu du jour', quantity: 2, unitAmount: 2800 })
      .expect(201);
    expect(r.body.reservationId).toBe(main.id);
    await folio(main.id, restaurant).expect(403);

    const [{ id: emptyRoom }] = await ds.query(`SELECT id FROM rooms WHERE status = 'available' LIMIT 1`);
    await http().post(`/v1/rooms/${emptyRoom}/charges`).set(auth(restaurant)).send({ category: 'bar', description: 'Café', unitAmount: 300 }).expect(409);

    await http()
      .post(`/v1/reservations/${main.id}/folio/charges`)
      .set(auth(reception))
      .send({ category: 'minibar', description: 'Eau minérale', unitAmount: 450 })
      .expect(201);
    const f = await folio(main.id).expect(200);
    const charges = f.body.lines.filter((l: { kind: string }) => l.kind === 'charge');
    expect(charges[0]).toMatchObject({ amount: 5600, vatRate: 1000, vatAmount: 509 });
    expect(charges[1]).toMatchObject({ amount: 450, vatRate: 2000, vatAmount: 75 });
    expect(f.body.balance).toBe(35650);
    await folio(main.id, housekeeping).expect(403);
  });

  it('encaissements : jamais de numéro de carte, référence obligatoire, remboursement plafonné', async () => {
    expect((await pay(main.id, { kind: 'payment', method: 'card', amount: 20000 })).status).toBe(422);
    for (const pspReference of ['4111111111111111', '4111 1111 1111 1111', '4111-1111-1111-1111']) {
      const pan = await pay(main.id, { kind: 'payment', method: 'card', amount: 20000, pspReference });
      expect(pan.status).toBe(422);
      expect(pan.body.detail).toContain('numéro de carte');
    }
    expect((await pay(main.id, { kind: 'deposit', method: 'cash', amount: 1000 })).status).toBe(409);
    expect((await pay(main.id, { kind: 'payment', method: 'purchase_order', amount: 1000 })).status).toBe(422);

    const ok = await pay(main.id, { kind: 'payment', method: 'card', amount: 20000, pspReference: 'TPE-20261001-0042' }).expect(201);
    expect(ok.body).toMatchObject({ paid: 20000, balance: 15650 });
    expect((await pay(main.id, { kind: 'refund', method: 'card', amount: 25000, pspReference: 'RF-1' })).status).toBe(422);

    // Les encaissements sont inaltérables, y compris en SQL direct.
    await expect(ds.query(`DELETE FROM payments WHERE reservation_id = $1`, [main.id])).rejects.toThrow(/inaltérable/);
  });
});

describe('Factures', () => {
  it('émission : numérotation continue, rejeu idempotent, une seule facture en vigueur', async () => {
    await http().post(`/v1/reservations/${main.id}/invoice`).set(auth(reception)).send({}).expect(400);
    const k = key();
    const inv = await http().post(`/v1/reservations/${main.id}/invoice`).set(auth(reception)).set('Idempotency-Key', k).send({ lang: 'fr' }).expect(201);
    expect(inv.body).toMatchObject({ number: `F${YEAR}-000001`, kind: 'invoice', totals: { ttc: 35650 } });
    expect(inv.body.lines).toHaveLength(4);
    expect(inv.body.hash).toMatch(/^[0-9a-f]{64}$/);
    firstInvoice = inv.body;

    const replay = await http().post(`/v1/reservations/${main.id}/invoice`).set(auth(reception)).set('Idempotency-Key', k).send({ lang: 'fr' }).expect(201);
    expect(replay.body.id).toBe(inv.body.id);
    const again = await http().post(`/v1/reservations/${main.id}/invoice`).set(auth(reception)).set('Idempotency-Key', key()).send({}).expect(409);
    expect(again.body.code).toBe('INVOICE_LOCKED');
  });

  it('un séjour facturé est figé ; la facture est inaltérable en base', async () => {
    const f = await folio(main.id).expect(200);
    expect(f.body).toMatchObject({ locked: true, invoice: { number: `F${YEAR}-000001` }, balance: 15650 });
    const add = await http().post(`/v1/reservations/${main.id}/folio/charges`).set(auth(reception)).send({ category: 'bar', description: 'Café', unitAmount: 300 });
    expect(add.status).toBe(409);
    expect(add.body.code).toBe('INVOICE_LOCKED');
    await expect(ds.query(`UPDATE invoices SET total_ttc = 1 WHERE id = $1`, [firstInvoice.id])).rejects.toThrow(/inaltérable/);
  });

  it('départ : refusé avec un solde dû, dérogation réservée aux profils habilités, accepté une fois réglé', async () => {
    const due = await http().post(`/v1/reservations/${main.id}/check-out`).set(auth(reception)).send({}).expect(409);
    expect(due.body).toMatchObject({ code: 'BALANCE_DUE', balance: 15650 });
    expect(due.body.detail).toContain('156.50');
    await http().post(`/v1/reservations/${main.id}/check-out`).set(auth(reception)).send({ overrideBalanceReason: 'Société paiera' }).expect(403);
    await pay(main.id, { kind: 'payment', method: 'cash', amount: 15650 }).expect(201);
    await http().post(`/v1/reservations/${main.id}/check-out`).set(auth(reception)).send({}).expect(200);
  });

  it('avoir : réservé à la comptabilité, annule la facture et rouvre le compte', async () => {
    await http().post(`/v1/invoices/${firstInvoice.id}/credit-note`).set(auth(reception)).set('Idempotency-Key', key()).send({ reason: 'Erreur' }).expect(403);
    const cn = await http()
      .post(`/v1/invoices/${firstInvoice.id}/credit-note`)
      .set(auth(accounting))
      .set('Idempotency-Key', key())
      .send({ reason: 'Erreur sur la prestation minibar' })
      .expect(201);
    expect(cn.body).toMatchObject({ number: `A${YEAR}-000001`, kind: 'credit_note', creditedInvoiceNumber: `F${YEAR}-000001`, totals: { ttc: -35650 } });
    await http().post(`/v1/invoices/${firstInvoice.id}/credit-note`).set(auth(accounting)).set('Idempotency-Key', key()).send({ reason: 'Encore' }).expect(409);

    const f = await folio(main.id).expect(200);
    expect(f.body.locked).toBe(false);
    const charge = f.body.lines.find((l: { category?: string }) => l.category === 'minibar');
    await http().delete(`/v1/reservations/${main.id}/folio/charges/${charge.chargeId}`).set(auth(reception)).expect(200);
    const reissued = await http().post(`/v1/reservations/${main.id}/invoice`).set(auth(reception)).set('Idempotency-Key', key()).send({}).expect(201);
    expect(reissued.body).toMatchObject({ number: `F${YEAR}-000002`, totals: { ttc: 35200 } });

    // Le client a payé 35 650 : il reste 450 de trop-perçu à rembourser.
    const after = await folio(main.id).expect(200);
    expect(after.body.balance).toBe(-450);
  });

  it('départ anticipé : prix ramené aux nuits passées, taxe de séjour recalculée', async () => {
    const early = await bookAndCheckIn('SGL', 4, 1);
    // Le client est arrivé hier pour 4 nuits et part aujourd'hui : 1 nuit passée.
    await ds.query(`UPDATE reservations SET arrival_date = $1, departure_date = $2 WHERE id = $3`, [addDays(T, -1), addDays(T, 3), early.id]);
    const due = await http().post(`/v1/reservations/${early.id}/check-out`).set(auth(reception)).send({}).expect(409);
    expect(due.body.balance).toBe(7500 + 150);
    await pay(early.id, { kind: 'payment', method: 'transfer', amount: 7650, reference: 'VIR-889' }).expect(201);
    const out = await http().post(`/v1/reservations/${early.id}/check-out`).set(auth(reception)).send({}).expect(200);
    expect(out.body).toMatchObject({ departureDate: T, totalAmount: 7500, nights: 1 });
  });
});

describe('Comptabilité et paramètres', () => {
  it('export : écritures équilibrées par pièce, comptes du plan par défaut', async () => {
    await http().get(`/v1/accounting/exports?from=${T}&to=${addDays(T, 1)}`).set(auth(reception)).expect(403);
    const res = await http().get(`/v1/accounting/exports?from=${T}&to=${addDays(T, 1)}`).set(auth(accounting)).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const rows = res.text.replace(/^\uFEFF/, '').trim().split('\r\n').slice(1).map((l) => l.split(';'));
    const num = (v: string) => (v ? Math.round(parseFloat(v.replace(',', '.')) * 100) : 0);
    const byPiece = new Map<string, number>();
    for (const r of rows) byPiece.set(r[2], (byPiece.get(r[2]) ?? 0) + num(r[5]) - num(r[6]));
    for (const [piece, diff] of byPiece) expect([piece, diff]).toEqual([piece, 0]);
    const accounts = new Set(rows.map((r) => r[3]));
    for (const a of ['411000', '706100', '706200', '467000', '445710', '511200', '530000', '512000']) expect(accounts).toContain(a);
    expect(rows.filter((r) => r[1] === 'VE').map((r) => r[2])).toEqual(expect.arrayContaining([`F${YEAR}-000001`, `A${YEAR}-000001`, `F${YEAR}-000002`]));
  });

  it('paramètres : modifiables par la direction avec If-Match, appliqués aux nouveaux séjours', async () => {
    const cur = await http().get('/v1/settings/billing').set(auth(reception)).expect(200);
    await http().put('/v1/settings/billing').set(auth(reception)).set('If-Match', `"${cur.body.version}"`).send({ touristTax: { perAdultPerNight: 200 } }).expect(403);
    await http().put('/v1/settings/billing').set(auth(admin)).send({ touristTax: { perAdultPerNight: 200 } }).expect(428);
    const upd = await http()
      .put('/v1/settings/billing')
      .set(auth(admin))
      .set('If-Match', `"${cur.body.version}"`)
      .send({ country: 'FR', touristTax: { perAdultPerNight: 200 }, seller: { legalName: 'Hôtel des Tests SAS' } })
      .expect(200);
    expect(upd.body).toMatchObject({ country: 'FR', touristTax: { perAdultPerNight: 200 }, seller: { legalName: 'Hôtel des Tests SAS' }, vat: { accommodation: 1000 } });
    const r = await bookAndCheckIn('SGL', 1, 1);
    const f = await folio(r.id).expect(200);
    expect(f.body.lines.find((l: { kind: string }) => l.kind === 'tourist_tax').amount).toBe(200);
  });

  it('intégrité : chaîne valide, puis toute altération en base est détectée', async () => {
    const ok = await http().get('/v1/invoices/integrity').set(auth(accounting)).expect(200);
    expect(ok.body).toMatchObject({ valid: true, checked: 3, errors: [] });
    await http().get('/v1/invoices/integrity').set(auth(reception)).expect(403);

    // Fraude simulée : un administrateur de base contourne le déclencheur pour baisser un montant.
    await ds.query(`ALTER TABLE invoice_lines DISABLE TRIGGER invoice_lines_immutable`);
    await ds.query(`UPDATE invoice_lines SET amount = amount - 1000 WHERE invoice_id = $1 AND position = 1`, [firstInvoice.id]);
    await ds.query(`ALTER TABLE invoice_lines ENABLE TRIGGER invoice_lines_immutable`);
    const ko = await http().get('/v1/invoices/integrity').set(auth(accounting)).expect(200);
    expect(ko.body.valid).toBe(false);
    expect(ko.body.errors).toEqual([{ number: `F${YEAR}-000001`, problem: 'contenu modifié (empreinte invalide)' }]);
  });

  it('liste des pièces : recherche par numéro ou client, pagination', async () => {
    const all = await http().get('/v1/invoices?limit=2').set(auth(accounting)).expect(200);
    expect(all.body.data.map((i: { number: string }) => i.number)).toEqual([`F${YEAR}-000002`, `A${YEAR}-000001`]);
    const next = await http().get(`/v1/invoices?limit=2&cursor=${all.body.nextCursor}`).set(auth(accounting)).expect(200);
    expect(next.body.data.map((i: { number: string }) => i.number)).toEqual([`F${YEAR}-000001`]);
    const credit = await http().get('/v1/invoices?kind=credit_note').set(auth(accounting)).expect(200);
    expect(credit.body.data).toHaveLength(1);
  });

  it('émissions simultanées : numéros consécutifs, sans trou ni doublon', async () => {
    const stays = [];
    for (const type of ['DBL', 'DBL', 'DBL', 'FAM', 'FAM']) stays.push(await bookAndCheckIn(type, 1, 1));
    const results = await Promise.all(
      stays.map((st) => http().post(`/v1/reservations/${st.id}/invoice`).set(auth(reception)).set('Idempotency-Key', key()).send({})),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    const numbers = results.map((r) => r.body.number as string).sort();
    expect(numbers).toEqual([3, 4, 5, 6, 7].map((n) => `F${YEAR}-${String(n).padStart(6, '0')}`));
    // La chaîne des nouvelles pièces est intacte (seule la pièce falsifiée plus haut est signalée).
    const check = await http().get('/v1/invoices/integrity').set(auth(accounting)).expect(200);
    expect(check.body.checked).toBe(8);
    expect(check.body.errors.map((e: { number: string }) => e.number)).toEqual([`F${YEAR}-000001`]);
  });
});
