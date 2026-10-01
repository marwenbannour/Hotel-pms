import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, hotelToday } from '../src/common/dates';
import { createTestApp, login } from './helpers';

let app: INestApplication;
let ds: DataSource;
let reception: string;
let housekeeping: string;
let types: Record<string, string>;
let rooms: Record<string, string>;
const T = hotelToday();
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let seq = 0;

async function book(type: string, from: number, to: number, adults = 2) {
  const res = await http()
    .post('/v1/reservations')
    .set(auth(reception))
    .set('Idempotency-Key', `plan-${++seq}`)
    .send({
      guest: { firstName: 'Client', lastName: `N${seq}` },
      roomTypeId: types[type],
      arrivalDate: addDays(T, from),
      departureDate: addDays(T, to),
      adults,
      board: 'room_only',
      channel: 'direct',
    })
    .expect(201);
  return res.body as { id: string; reference: string; version: number };
}

const assign = (id: string, roomId: string | null, ifMatch: string | null = '*') => {
  const req = http().put(`/v1/reservations/${id}/room`).set(auth(reception));
  if (ifMatch) req.set('If-Match', ifMatch);
  return req.send({ roomId });
};

beforeAll(async () => {
  ({ app, ds } = await createTestApp());
  reception = (await login(app, 'reception@hotel.local')).accessToken;
  housekeeping = (await login(app, 'menage@hotel.local')).accessToken;
  types = Object.fromEntries((await ds.query('SELECT id, code FROM room_types')).map((r: { id: string; code: string }) => [r.code, r.id]));
  rooms = Object.fromEntries((await ds.query('SELECT id, number FROM rooms')).map((r: { id: string; number: string }) => [r.number, r.id]));
});

afterAll(() => app.close());

describe('Pré-attribution des chambres', () => {
  it('attribue, refuse un doublon sur les mêmes nuits, un autre type ou une requête sans If-Match', async () => {
    const a = await book('DBL', 2, 5);
    const b = await book('DBL', 3, 4);

    await assign(a.id, rooms['201'], null).expect(428);
    const ok = await assign(a.id, rooms['201'], `"${a.version}"`).expect(200);
    expect(ok.body.room).toMatchObject({ number: '201' });

    const clash = await assign(b.id, rooms['201']).expect(409);
    expect(clash.body.code).toBe('ROOM_UNAVAILABLE');
    expect(clash.body.detail).toContain(a.reference);

    await assign(b.id, rooms['101']).expect(422);

    const history = await http().get(`/v1/reservations/${a.id}/history`).set(auth(reception)).expect(200);
    expect(JSON.stringify(history.body)).toContain('reservation.room_assigned');

    // Retrait de l'attribution
    const un = await assign(a.id, null).expect(200);
    expect(un.body.room).toBeNull();
    await assign(a.id, rooms['201']).expect(200);
  });

  it('l’attribution automatique à l’arrivée ignore les chambres promises à d’autres séjours', async () => {
    // La 201 est promise du jour J+2 au J+5 (test précédent) ; ce séjour J → J+3 la recoupe.
    const c = await book('DBL', 0, 3);
    const res = await http().post(`/v1/reservations/${c.id}/check-in`).set(auth(reception)).send({}).expect(200);
    expect(res.body.room.number).not.toBe('201');
  });

  it('l’arrivée utilise la chambre pré-attribuée, et refuse si elle n’est pas prête', async () => {
    const e = await book('DBL', 0, 1);
    await assign(e.id, rooms['203']).expect(200);
    const ok = await http().post(`/v1/reservations/${e.id}/check-in`).set(auth(reception)).send({}).expect(200);
    expect(ok.body.room.number).toBe('203');

    const f = await book('DBL', 0, 1);
    await assign(f.id, rooms['204']).expect(200);
    await ds.query(`UPDATE rooms SET status = 'cleaning' WHERE number = '204'`);
    const ko = await http().post(`/v1/reservations/${f.id}/check-in`).set(auth(reception)).send({}).expect(409);
    expect(ko.body.detail).toContain('pré-attribuée');
  });

  it('un changement de type de chambre retire l’attribution', async () => {
    const g = await book('DBL', 10, 12);
    const assigned = await assign(g.id, rooms['202']).expect(200);
    const res = await http()
      .patch(`/v1/reservations/${g.id}`)
      .set(auth(reception))
      .set('If-Match', `"${assigned.body.version}"`)
      .send({ roomTypeId: types.FAM })
      .expect(200);
    expect(res.body.room).toBeNull();
  });
});

describe('Planning', () => {
  it('renvoie chambres et séjours de la période, avec les attributions', async () => {
    const res = await http().get(`/v1/planning?from=${T}&to=${addDays(T, 7)}`).set(auth(reception)).expect(200);
    expect(res.body.rooms).toHaveLength(9);
    expect(res.body.roomTypes.map((t: { code: string }) => t.code)).toEqual(['DBL', 'FAM', 'SGL']);
    const assignedTo201 = res.body.stays.filter((s: { roomId: string | null }) => s.roomId === rooms['201']);
    expect(assignedTo201).toHaveLength(1);
    expect(res.body.stays.some((s: { roomId: string | null }) => s.roomId === null)).toBe(true);
    // Séjour hors période (J+10 → J+12) absent
    expect(res.body.stays.every((s: { arrivalDate: string }) => s.arrivalDate < addDays(T, 7))).toBe(true);
  });

  it('montre un départ en retard qui occupe encore sa chambre', async () => {
    const [{ id: guestId }] = await ds.query(`INSERT INTO guests (first_name, last_name) VALUES ('En', 'Retard') RETURNING id`);
    await ds.query(
      `INSERT INTO reservations (reference, guest_id, room_type_id, room_id, arrival_date, departure_date, adults, board, channel, status, total_amount, currency)
       VALUES ('RLATE001', $1, $2, $3, $4, $5, 1, 'room_only', 'direct', 'checked_in', 0, 'EUR')`,
      [guestId, types.SGL, rooms['103'], addDays(T, -3), addDays(T, -1)],
    );
    const res = await http().get(`/v1/planning?from=${T}&to=${addDays(T, 7)}`).set(auth(reception)).expect(200);
    expect(res.body.stays.find((s: { reference: string }) => s.reference === 'RLATE001')).toMatchObject({ overdue: true, roomId: rooms['103'] });
    // Un client qui part aujourd'hui n'est pas en retard.
    const leaving = await book('SGL', 0, 1, 1);
    await http().post(`/v1/reservations/${leaving.id}/check-in`).set(auth(reception)).send({}).expect(200);
    await ds.query(`UPDATE reservations SET arrival_date = $1, departure_date = $2 WHERE id = $3`, [addDays(T, -2), T, leaving.id]);
    const again = await http().get(`/v1/planning?from=${addDays(T, -1)}&to=${addDays(T, 7)}`).set(auth(reception)).expect(200);
    expect(again.body.stays.find((s: { id: string }) => s.id === leaving.id)).toMatchObject({ overdue: false });
  });

  it('limite la période et protège les noms des clients', async () => {
    await http().get(`/v1/planning?from=${T}&to=${addDays(T, 40)}`).set(auth(reception)).expect(422);
    await http().get(`/v1/planning?from=${T}&to=${addDays(T, 7)}`).set(auth(housekeeping)).expect(403);
  });
});
