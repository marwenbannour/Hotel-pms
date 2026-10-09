import { INestApplication } from '@nestjs/common';
import { AddressInfo } from 'net';
import { Subject } from 'rxjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, hotelToday } from '../src/common/dates';
import { EventsService } from '../src/modules/events/events.service';
import { createTestApp, login } from './helpers';

let app: INestApplication;
let ds: DataSource;
let base: string;
let reception: string;
let housekeeping: string;
let dbl: string;
const today = hotelToday();
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

interface SseEvent {
  event: string;
  data: unknown;
}

/** Abonnement au flux : lecture événement par événement, `ping` ignorés. */
async function subscribe(token: string) {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/v1/events`, { headers: auth(token), signal: ctrl.signal });
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toMatch(/^text\/event-stream/);
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';

  const next = async (timeoutMs = 3_000): Promise<SseEvent> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const end = buf.indexOf('\n\n');
      if (end >= 0) {
        const block = buf.slice(0, end);
        buf = buf.slice(end + 2);
        let event = 'message';
        let data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (event === 'ping') continue;
        return { event, data: data ? JSON.parse(data) : undefined };
      }
      const left = deadline - Date.now();
      if (left <= 0) throw new Error('Aucun événement reçu');
      const chunk = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Aucun événement reçu')), left)),
      ]);
      if (chunk.done) throw new Error('Flux fermé');
      buf += chunk.value;
    }
  };

  return { next, close: () => ctrl.abort() };
}

beforeAll(async () => {
  ({ app, ds } = await createTestApp());
  await app.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  reception = (await login(app, 'reception@hotel.local')).accessToken;
  housekeeping = (await login(app, 'menage@hotel.local')).accessToken;
  [{ id: dbl }] = await ds.query(`SELECT id FROM room_types WHERE code = 'DBL'`);
});

afterAll(() => app.close());

describe('Flux des modifications', () => {
  it('exige une session', async () => {
    await http().get('/v1/events').expect(401);
  });

  it('signale une modification avec son identifiant, `ready` à la connexion', async () => {
    const sub = await subscribe(reception);
    try {
      expect((await sub.next()).event).toBe('ready');
      const [room] = (await http().get('/v1/rooms?status=available&limit=1').set(auth(reception)).expect(200)).body.data;
      await http()
        .patch(`/v1/rooms/${room.id}/status`)
        .set(auth(reception))
        .set('If-Match', `"${room.version}"`)
        .send({ status: 'maintenance' })
        .expect(200);
      expect(await sub.next()).toMatchObject({ event: 'change', data: { topics: ['rooms'], id: room.id } });
    } finally {
      sub.close();
    }
  });

  it('ne signale ni un échec ni une réponse rejouée par l’idempotence', async () => {
    const sub = await subscribe(reception);
    try {
      await sub.next(); // ready
      const [room] = (await http().get('/v1/rooms?status=available&limit=1').set(auth(reception)).expect(200)).body.data;
      // Version périmée : refusée, rien n'est signalé.
      await http().patch(`/v1/rooms/${room.id}/status`).set(auth(reception)).set('If-Match', '"0"').send({ status: 'maintenance' }).expect(412);

      const body = {
        guest: { firstName: 'Léa', lastName: 'Flux' },
        roomTypeId: dbl,
        arrivalDate: addDays(today, 10),
        departureDate: addDays(today, 12),
        adults: 2,
        board: 'room_only',
        channel: 'direct',
      };
      const created = await http().post('/v1/reservations').set(auth(reception)).set('Idempotency-Key', 'events-1').send(body).expect(201);
      await http().post('/v1/reservations').set(auth(reception)).set('Idempotency-Key', 'events-1').send(body).expect(201);
      await http()
        .patch(`/v1/rooms/${room.id}/status`)
        .set(auth(reception))
        .set('If-Match', `"${room.version}"`)
        .send({ status: 'maintenance' })
        .expect(200);

      expect(await sub.next()).toMatchObject({ event: 'change', data: { topics: ['reservations'], id: created.body.id } });
      expect(await sub.next()).toMatchObject({ event: 'change', data: { topics: ['rooms'], id: room.id } });
    } finally {
      sub.close();
    }
  });

  it('ne transmet que les sujets lisibles par le profil', async () => {
    const hk = await subscribe(housekeeping);
    try {
      await hk.next(); // ready
      const res = await http()
        .post('/v1/reservations')
        .set(auth(reception))
        .set('Idempotency-Key', 'events-2')
        .send({
          guest: { firstName: 'Léa', lastName: 'Arrivée' },
          roomTypeId: dbl,
          arrivalDate: today,
          departureDate: addDays(today, 1),
          adults: 2,
          board: 'room_only',
          channel: 'direct',
        })
        .expect(201);
      // Le ménage est prévenu (son tableau de bord en dépend), sans sujet ni identifiant de réservation.
      const created = await hk.next();
      expect(created).toMatchObject({ event: 'change', data: { topics: [] } });
      expect(created.data).not.toHaveProperty('id');

      await http().post(`/v1/reservations/${res.body.id}/check-in`).set(auth(reception)).send({}).expect(200);
      const checkedIn = await hk.next();
      expect(checkedIn).toMatchObject({ event: 'change', data: { topics: ['rooms'] } });
      expect(checkedIn.data).not.toHaveProperty('id');
    } finally {
      hk.close();
    }
  });

  it('libère l’abonnement quand l’écran se déconnecte', async () => {
    const bus = (app.get(EventsService) as unknown as { changes: Subject<unknown> }).changes;
    const sub = await subscribe(reception);
    await sub.next(); // ready
    expect(bus.observed).toBe(true);
    sub.close();
    for (let i = 0; i < 50 && bus.observed; i++) await new Promise((r) => setTimeout(r, 20));
    expect(bus.observed).toBe(false);
  });
});
