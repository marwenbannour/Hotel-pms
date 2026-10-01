import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, hotelToday } from '../src/common/dates';
import { createTestApp, login, loginWithMfa } from './helpers';

let app: INestApplication;
let ds: DataSource;
let reception: string;
let housekeeping: string;
let admin: string;
let dbl: string;
const today = hotelToday();
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

const book = (body: Record<string, unknown>) =>
  http().post('/v1/reservations').set(auth(reception)).set('Idempotency-Key', `dash-${++seq}`).send({
    guest: { firstName: 'Léa', lastName: `Martin${seq}` },
    roomTypeId: dbl,
    adults: 2,
    board: 'half_board',
    channel: 'direct',
    ...body,
  });

beforeAll(async () => {
  ({ app, ds } = await createTestApp());
  reception = (await login(app, 'reception@hotel.local')).accessToken;
  housekeeping = (await login(app, 'menage@hotel.local')).accessToken;
  admin = await loginWithMfa(app, 'admin@hotel.local');
  [{ id: dbl }] = await ds.query(`SELECT id FROM room_types WHERE code = 'DBL'`);

  // Deux arrivées du jour pour 2 nuits en demi-pension : 9 500 + 2 × 2 500 = 14 500 par nuit.
  const a = await book({ arrivalDate: today, departureDate: addDays(today, 2) }).expect(201);
  await book({ arrivalDate: today, departureDate: addDays(today, 2) }).expect(201);
  await http().post(`/v1/reservations/${a.body.id}/check-in`).set(auth(reception)).send({}).expect(200);
});

afterAll(() => app.close());

describe('Tableau de bord', () => {
  it('le ménage ne voit que les chambres et les alertes, en arabe par défaut', async () => {
    const res = await http().get('/v1/dashboard').set(auth(housekeeping)).expect(200);
    expect(res.body.sections).toEqual(['rooms', 'alerts']);
    expect(res.body.movements).toBeUndefined();
    expect(res.body.kpis).toBeUndefined();
    expect(res.body.rooms).toMatchObject({ total: 9, occupied: 1, available: 8, departingToday: [] });
  });

  it('la réception voit les mouvements et l’occupation, sans montants', async () => {
    const res = await http().get('/v1/dashboard').set(auth(reception)).expect(200);
    expect(res.body.sections).toEqual(['rooms', 'movements', 'alerts', 'kpis']);
    const tomorrow = await http().get(`/v1/dashboard?date=${addDays(today, 2)}`).set(auth(housekeeping)).expect(200);
    expect(tomorrow.body.rooms.departingToday).toHaveLength(1);
    expect(res.body.movements).toMatchObject({ arrivalsPending: 1, inHouse: 1 });
    expect(res.body.movements.arrivals).toHaveLength(2);
    expect(res.body.kpis.today).toEqual({ occupancyRate: 22.2, roomsSold: 2, roomsAvailable: 9 });
    expect(JSON.stringify(res.body.kpis)).not.toContain('revenue');
  });

  it('la direction voit occupation, ADR, RevPAR et tendance sur 15 jours', async () => {
    const res = await http().get('/v1/dashboard').set(auth(admin)).expect(200);
    const { today: kpi, trend } = res.body.kpis;
    expect(kpi).toMatchObject({ roomsSold: 2, roomsAvailable: 9, occupancyRate: 22.2, revenue: 29000, adr: 14500, revpar: 3222 });
    expect(trend).toHaveLength(15);
    expect(trend.find((d: { date: string }) => d.date === addDays(today, 1))).toMatchObject({ occupancyRate: 22.2, forecast: true });
    expect(trend.find((d: { date: string }) => d.date === addDays(today, 2)).occupancyRate).toBe(0);
  });

  it('indicateurs sur une période, réservés aux profils autorisés', async () => {
    const q = `/v1/reports/kpis?from=${today}&to=${addDays(today, 4)}`;
    await http().get(q).set(auth(reception)).expect(403);
    const res = await http().get(q).set(auth(admin)).expect(200);
    // 4 nuits × 9 chambres = 36 disponibles ; 2 séjours × 2 nuits = 4 vendues.
    expect(res.body.totals).toMatchObject({
      roomsAvailable: 36, roomsSold: 4, occupancyRate: 11.1, revenue: 58000, adr: 14500, revpar: 1611,
      averageLengthOfStay: 2, staysCount: 2,
    });
    expect(res.body.daily).toHaveLength(4);
    await http().get(`/v1/reports/kpis?from=${today}&to=${today}`).set(auth(admin)).expect(422);
  });

  it('alertes : départ en retard, no-show, manque de chambres prêtes, maintenance', async () => {
    const [{ id: guestId }] = await ds.query(`INSERT INTO guests (first_name, last_name) VALUES ('Old', 'Stay') RETURNING id`);
    const ins = (status: string, from: number, to: number, ref: string) =>
      ds.query(
        `INSERT INTO reservations (reference, guest_id, room_type_id, arrival_date, departure_date, adults, board, channel, status, total_amount, currency)
         VALUES ($1, $2, $3, $4, $5, 1, 'room_only', 'direct', $6, 0, 'EUR')`,
        [ref, guestId, dbl, addDays(today, from), addDays(today, to), status],
      );
    await ins('checked_in', -3, -1, 'ROVERDUE');
    await ins('confirmed', -2, 1, 'RNOSHOW1');
    // Il reste 1 arrivée DBL à loger : on retire toutes les chambres doubles libres de la vente.
    await ds.query(`UPDATE rooms SET status = 'maintenance' WHERE status = 'available' AND room_type_id = $1`, [dbl]);

    const res = await http().get('/v1/dashboard').set(auth(reception)).set('Accept-Language', 'fr').expect(200);
    const types = res.body.alerts.map((a: { type: string }) => a.type);
    expect(types).toEqual(['overdue_departure', 'pending_no_show', 'arrival_room_shortage', 'rooms_in_maintenance']);
    expect(res.body.alerts[2]).toMatchObject({ severity: 'warning', roomTypeCode: 'DBL', count: 1 });
    expect(res.body.alerts[3].message).toBe('3 chambre(s) en maintenance, retirée(s) de la vente.');

    const hk = await http().get('/v1/dashboard').set(auth(housekeeping)).expect(200);
    expect(hk.body.alerts.map((a: { type: string }) => a.type)).toEqual(['rooms_in_maintenance']);
    expect(hk.body.alerts[0].message).toContain('صيانة');
  });
});
