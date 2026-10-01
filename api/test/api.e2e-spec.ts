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
let types: Record<string, string>;

const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let keySeq = 0;
const idemKey = () => `test-key-${Date.now()}-${++keySeq}`;

const newReservation = (over: Record<string, unknown> = {}) => ({
  guest: { firstName: 'Amina', lastName: 'Benali', email: 'amina@example.com' },
  roomTypeId: types.DBL,
  arrivalDate: addDays(hotelToday(), 10),
  departureDate: addDays(hotelToday(), 12),
  adults: 2,
  board: 'half_board',
  channel: 'phone',
  ...over,
});

function book(body: Record<string, unknown>, token = reception) {
  return http().post('/v1/reservations').set(auth(token)).set('Idempotency-Key', idemKey()).send(body);
}

beforeAll(async () => {
  ({ app, ds } = await createTestApp());
  reception = (await login(app, 'reception@hotel.local')).accessToken;
  housekeeping = (await login(app, 'menage@hotel.local')).accessToken;
  admin = await loginWithMfa(app, 'admin@hotel.local');
  const rows: { id: string; code: string }[] = await ds.query('SELECT id, code FROM room_types');
  types = Object.fromEntries(rows.map((r) => [r.code, r.id]));
});

afterAll(async () => {
  await app.close();
});

describe('Socle transverse', () => {
  it('health, en-têtes API-Version et X-Request-Id', async () => {
    const res = await http().get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['api-version']).toBe('1.0.0');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('erreurs au format RFC 9457, titre traduit selon Accept-Language', async () => {
    const fr = await http().post('/v1/auth/login').send({ email: 'x@hotel.local', password: 'bad' }).expect(401);
    expect(fr.headers['content-type']).toContain('application/problem+json');
    expect(fr.body).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', title: 'Identifiants incorrects' });
    expect(fr.body.type).toMatch(/\/errors\/invalid-credentials$/);
    expect(fr.body.traceId).toBe(fr.headers['x-request-id']);

    const ar = await http().post('/v1/auth/login').set('Accept-Language', 'ar').send({ email: 'x@hotel.local', password: 'bad' });
    expect(ar.body.title).toBe('بيانات الدخول غير صحيحة');
  });

  it('validation : 422 avec la liste des champs en erreur', async () => {
    const res = await book({ ...newReservation(), adults: 0, board: 'all_inclusive' }).expect(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['adults', 'board']));
  });

  it('identifiant mal formé → 404, en-têtes RateLimit-*', async () => {
    const res = await http().get('/v1/reservations/not-a-uuid').set(auth(reception)).expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});

describe('Authentification', () => {
  it('rotation du jeton de rafraîchissement et révocation de la famille en cas de réutilisation', async () => {
    const first = await login(app, 'reception@hotel.local');
    const second = await http().post('/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);

    // Réutilisation de l'ancien jeton : refusée, et toute la session est révoquée.
    await http().post('/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: second.body.refreshToken }).expect(401);

    const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'auth.refresh_reuse_detected'`);
    expect(n).toBeGreaterThan(0);
  });

  it('la comptabilité doit activer la MFA avant d’accéder aux données', async () => {
    const t = await login(app, 'compta@hotel.local');
    expect(t.mfaEnrollmentRequired).toBe(true);
    const blocked = await http().get('/v1/reservations').set(auth(t.accessToken)).expect(403);
    expect(blocked.body.code).toBe('MFA_REQUIRED');
    const me = await http().get('/v1/me').set(auth(t.accessToken)).expect(200);
    expect(me.body.hotel).toMatchObject({ today: hotelToday(), currency: 'EUR' });

    const token = await loginWithMfa(app, 'compta@hotel.local');
    await http().get('/v1/reservations').set(auth(token)).expect(200);
  });

  it('le profil ménage n’a pas accès aux réservations', async () => {
    const res = await http().get('/v1/reservations').set(auth(housekeeping)).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

describe('Menu dynamique', () => {
  const keys = (items: { key: string; children: { key: string }[] }[]): string[] =>
    items.flatMap((i) => [i.key, ...keys(i.children as never)]);

  it('filtré par droits ; langue du profil (arabe, RTL) par défaut', async () => {
    const res = await http().get('/v1/me/navigation').set(auth(housekeeping)).expect(200);
    expect(res.body.dir).toBe('rtl');
    expect(keys(res.body.items)).toEqual(['dashboard', 'housekeeping']);
    expect(res.body.items[1].label).toBe('التدبير المنزلي');
  });

  it('aucun groupe vide, et le groupe Administration est visible pour la direction', async () => {
    const rec = await http().get('/v1/me/navigation').set(auth(reception)).expect(200);
    expect(keys(rec.body.items)).not.toContain('admin');
    const adm = await http().get('/v1/me/navigation').set(auth(admin)).set('Accept-Language', 'en').expect(200);
    expect(keys(adm.body.items)).toEqual(expect.arrayContaining(['admin', 'admin.menu', 'reports']));
    expect(adm.body.items[0].label).toBe('Dashboard');
  });

  it('les modules non activés sont masqués, et s’affichent dès leur activation', async () => {
    const before = await http().get('/v1/me/navigation').set(auth(admin)).expect(200);
    expect(keys(before.body.items)).not.toContain('restaurant');
    process.env.ENABLED_MODULES = 'core,restaurant';
    const after = await http().get('/v1/me/navigation').set(auth(admin)).expect(200);
    expect(keys(after.body.items)).toContain('restaurant');
    process.env.ENABLED_MODULES = 'core';
  });

  it('l’administrateur modifie le menu sans redéploiement', async () => {
    const list = await http().get('/v1/navigation-items').set(auth(admin)).expect(200);
    const guests = list.body.data.find((i: { key: string }) => i.key === 'guests');
    await http().patch(`/v1/navigation-items/${guests.id}`).set(auth(admin)).send({ enabled: false }).expect(428);
    await http()
      .patch(`/v1/navigation-items/${guests.id}`)
      .set(auth(admin))
      .set('If-Match', `"${guests.version}"`)
      .send({ enabled: false, labelFr: 'Fichier clients' })
      .expect(200);
    const rec = await http().get('/v1/me/navigation').set(auth(reception)).expect(200);
    expect(keys(rec.body.items)).not.toContain('guests');

    await http().patch('/v1/navigation-items/' + guests.id).set(auth(reception)).set('If-Match', '*').send({ enabled: true }).expect(403);
    await http().patch('/v1/navigation-items/' + guests.id).set(auth(admin)).set('If-Match', '*').send({ enabled: true }).expect(200);
  });
});

describe('Réservations', () => {
  it('Idempotency-Key obligatoire, rejeu identique, réutilisation refusée', async () => {
    await http().post('/v1/reservations').set(auth(reception)).send(newReservation()).expect(400);

    const key = idemKey();
    const body = newReservation();
    const a = await http().post('/v1/reservations').set(auth(reception)).set('Idempotency-Key', key).send(body).expect(201);
    const b = await http().post('/v1/reservations').set(auth(reception)).set('Idempotency-Key', key).send(body).expect(201);
    expect(b.body.id).toBe(a.body.id);
    expect(b.headers['idempotent-replayed']).toBe('true');
    const [{ n }] = await ds.query('SELECT count(*)::int AS n FROM reservations WHERE id = $1', [a.body.id]);
    expect(n).toBe(1);

    const c = await http().post('/v1/reservations').set(auth(reception)).set('Idempotency-Key', key).send({ ...body, adults: 1 }).expect(422);
    expect(c.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('calcule le prix : nuits × (tarif + supplément pension × personnes)', async () => {
    const res = await book(newReservation()).expect(201);
    // 2 nuits × (9 500 + 2 500 × 2) = 29 000
    expect(res.body).toMatchObject({ nights: 2, totalAmount: 29000, currency: 'EUR', status: 'confirmed' });
    expect(res.body.reference).toMatch(/^R[A-Z0-9]{7}$/);
  });

  it('refuse la surréservation (2 chambres familiales)', async () => {
    const dates = { arrivalDate: addDays(hotelToday(), 20), departureDate: addDays(hotelToday(), 23) };
    const body = newReservation({ roomTypeId: types.FAM, adults: 3, board: 'room_only', ...dates });
    await book(body).expect(201);
    await book(body).expect(201);
    const full = await book(body).expect(409);
    expect(full.body.code).toBe('NO_AVAILABILITY');
    expect(full.body.unavailableNights).toHaveLength(3);
  });

  it('reste cohérente sous des ventes simultanées (3 chambres simples, 8 demandes)', async () => {
    const dates = { arrivalDate: addDays(hotelToday(), 30), departureDate: addDays(hotelToday(), 31) };
    const body = newReservation({ roomTypeId: types.SGL, adults: 1, board: 'room_only', ...dates });
    const results = await Promise.all(Array.from({ length: 8 }, () => book(body)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
  });

  it('refuse un nombre de personnes supérieur à la capacité', async () => {
    const res = await book(newReservation({ roomTypeId: types.SGL, adults: 2 })).expect(422);
    expect(res.body.detail).toContain('Capacité');
  });

  it('contrôle de concurrence : If-Match absent → 428, périmé → 412, à jour → 200', async () => {
    const created = await book(newReservation()).expect(201);
    const got = await http().get(`/v1/reservations/${created.body.id}`).set(auth(reception)).expect(200);
    expect(got.headers.etag).toBe('"1"');

    const url = `/v1/reservations/${created.body.id}`;
    await http().patch(url).set(auth(reception)).send({ adults: 1 }).expect(428);
    await http().patch(url).set(auth(reception)).set('If-Match', '"99"').send({ adults: 1 }).expect(412);
    const ok = await http().patch(url).set(auth(reception)).set('If-Match', '"1"').send({ adults: 1, board: 'room_only' }).expect(200);
    expect(ok.headers.etag).toBe('"2"');
    expect(ok.body.totalAmount).toBe(2 * 9500);
  });

  it('l’annulation libère le stock', async () => {
    const dates = { arrivalDate: addDays(hotelToday(), 40), departureDate: addDays(hotelToday(), 41) };
    const q = `/v1/availability?from=${dates.arrivalDate}&to=${dates.departureDate}&room_type_id=${types.FAM}`;
    const created = await book(newReservation({ roomTypeId: types.FAM, board: 'room_only', ...dates })).expect(201);
    const before = await http().get(q).set(auth(reception)).expect(200);
    expect(before.body.roomTypes[0].available).toBe(1);

    await http().post(`/v1/reservations/${created.body.id}/cancel`).set(auth(reception)).send({ reason: 'Demande du client' }).expect(200);
    const after = await http().get(q).set(auth(reception)).expect(200);
    expect(after.body.roomTypes[0].available).toBe(2);
  });

  it('liste paginée par curseur, filtres et sélection de champs', async () => {
    const page1 = await http().get('/v1/reservations?limit=2&status=confirmed&fields=reference,status').set(auth(reception)).expect(200);
    expect(page1.body.data).toHaveLength(2);
    expect(Object.keys(page1.body.data[0]).sort()).toEqual(['id', 'reference', 'status']);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await http().get(`/v1/reservations?limit=2&status=confirmed&cursor=${page1.body.nextCursor}`).set(auth(reception)).expect(200);
    const ids1 = page1.body.data.map((r: { id: string }) => r.id);
    expect(page2.body.data.some((r: { id: string }) => ids1.includes(r.id))).toBe(false);

    await http().get(`/v1/reservations?sort=created_at&cursor=${page1.body.nextCursor}`).set(auth(reception)).expect(400);
  });
});

describe('Réception et ménage', () => {
  it('parcours complet : arrivée, chambre occupée, départ, nettoyage, remise en service', async () => {
    const created = await book(
      newReservation({ arrivalDate: hotelToday(), departureDate: addDays(hotelToday(), 2), board: 'room_only' }),
    ).expect(201);
    const id = created.body.id;

    const cin = await http().post(`/v1/reservations/${id}/check-in`).set(auth(reception)).send({}).expect(200);
    expect(cin.body.status).toBe('checked_in');
    expect(cin.body.room.number).toMatch(/^20\d$/);
    const roomId = cin.body.room.id;

    let room = await http().get(`/v1/rooms/${roomId}`).set(auth(housekeeping)).expect(200);
    expect(room.body.status).toBe('occupied');

    // Second check-in refusé ; le ménage ne peut pas libérer une chambre occupée.
    await http().post(`/v1/reservations/${id}/check-in`).set(auth(reception)).send({}).expect(409);
    await http().patch(`/v1/rooms/${roomId}/status`).set(auth(housekeeping)).set('If-Match', room.headers.etag).send({ status: 'available' }).expect(409);

    // Départ refusé tant que le séjour n'est pas réglé, puis accepté après encaissement.
    const due = await http().post(`/v1/reservations/${id}/check-out`).set(auth(reception)).expect(409);
    expect(due.body.code).toBe('BALANCE_DUE');
    await http()
      .post(`/v1/reservations/${id}/payments`)
      .set(auth(reception))
      .set('Idempotency-Key', `pay-${id}`)
      .send({ kind: 'payment', method: 'cash', amount: due.body.balance })
      .expect(201);
    const cout = await http().post(`/v1/reservations/${id}/check-out`).set(auth(reception)).expect(200);
    expect(cout.body.status).toBe('checked_out');

    room = await http().get(`/v1/rooms/${roomId}`).set(auth(housekeeping)).expect(200);
    expect(room.body.status).toBe('cleaning');
    const clean = await http()
      .patch(`/v1/rooms/${roomId}/status`)
      .set(auth(housekeeping))
      .set('If-Match', room.headers.etag)
      .send({ status: 'available' })
      .expect(200);
    expect(clean.body.status).toBe('available');

    const audit: { action: string }[] = await ds.query(
      `SELECT action FROM audit_logs WHERE entity_id = $1 ORDER BY created_at`,
      [id],
    );
    expect(audit.map((a) => a.action)).toEqual(['reservation.created', 'reservation.checked_in', 'payment.recorded', 'reservation.checked_out']);
  });

  it('refuse une chambre choisie déjà occupée', async () => {
    const today = { arrivalDate: hotelToday(), departureDate: addDays(hotelToday(), 1), board: 'room_only' };
    const a = await book(newReservation(today)).expect(201);
    const b = await book(newReservation(today)).expect(201);
    const cin = await http().post(`/v1/reservations/${a.body.id}/check-in`).set(auth(reception)).send({}).expect(200);
    const res = await http()
      .post(`/v1/reservations/${b.body.id}/check-in`)
      .set(auth(reception))
      .send({ roomId: cin.body.room.id })
      .expect(409);
    expect(res.body.code).toBe('ROOM_UNAVAILABLE');
  });

  it('la base refuse physiquement deux séjours actifs sur la même chambre', async () => {
    const [{ id: roomId }] = await ds.query(`SELECT id FROM rooms WHERE number = '301'`);
    const created = await book(newReservation({ roomTypeId: types.FAM, board: 'room_only' })).expect(201);
    const other = await book(newReservation({ roomTypeId: types.FAM, board: 'room_only' })).expect(201);
    await ds.query('UPDATE reservations SET room_id = $1 WHERE id = $2', [roomId, created.body.id]);
    await expect(ds.query('UPDATE reservations SET room_id = $1 WHERE id = $2', [roomId, other.body.id])).rejects.toThrow(
      /reservations_no_room_overlap/,
    );
  });
});

describe('Clients', () => {
  it('recherche, historique des séjours et effacement RGPD', async () => {
    const guest = await http()
      .post('/v1/guests')
      .set(auth(reception))
      .send({ firstName: 'Karim', lastName: 'Haddad', email: 'karim@example.com', nationality: 'MA' })
      .expect(201);

    const found = await http().get('/v1/guests?q=hadd').set(auth(reception)).expect(200);
    expect(found.body.data.map((g: { id: string }) => g.id)).toContain(guest.body.id);

    const r = await book(newReservation({ guest: undefined, guestId: guest.body.id })).expect(201);
    const stays = await http().get(`/v1/guests/${guest.body.id}/stays`).set(auth(reception)).expect(200);
    expect(stays.body.data[0].reference).toBe(r.body.reference);

    // Effacement : réservé à la direction, bloqué tant qu'un séjour est actif.
    await http().post(`/v1/guests/${guest.body.id}/erase`).set(auth(reception)).expect(403);
    await http().post(`/v1/guests/${guest.body.id}/erase`).set(auth(admin)).expect(409);
    await http().post(`/v1/reservations/${r.body.id}/cancel`).set(auth(reception)).send({ reason: 'test' }).expect(200);
    const erased = await http().post(`/v1/guests/${guest.body.id}/erase`).set(auth(admin)).expect(200);
    expect(erased.body).toMatchObject({ erased: true, lastName: 'ANONYMISÉ', email: null });

    const after = await http().get('/v1/guests?q=hadd').set(auth(reception)).expect(200);
    expect(after.body.data).toHaveLength(0);
  });
});

describe('Réservations : recherche, devis et historique', () => {
  it('recherche par nom, prénom, email ou référence ; filtre par date de départ', async () => {
    const created = await book(
      newReservation({
        guest: { firstName: 'Zoé', lastName: 'Lefèvre-Nguyen', email: 'zoe.ln@example.com' },
        arrivalDate: addDays(hotelToday(), 80),
        departureDate: addDays(hotelToday(), 81),
      }),
    ).expect(201);
    const ids = async (q: string) =>
      (await http().get(`/v1/reservations?q=${encodeURIComponent(q)}`).set(auth(reception)).expect(200)).body.data.map((r: { id: string }) => r.id);

    expect(await ids('lefèvre')).toContain(created.body.id);
    expect(await ids('zoé lef')).toContain(created.body.id);
    expect(await ids('zoe.ln@')).toContain(created.body.id);
    expect(await ids(created.body.reference.toLowerCase())).toEqual([created.body.id]);
    // Les jokers SQL saisis par l'utilisateur sont traités comme du texte.
    expect(await ids('%_')).toHaveLength(0);

    const dep = created.body.departureDate;
    const byDeparture = await http().get(`/v1/reservations?departure_from=${dep}&departure_to=${dep}`).set(auth(reception)).expect(200);
    expect(byDeparture.body.data.every((r: { departureDate: string }) => r.departureDate === dep)).toBe(true);
  });

  it('devis : même prix que la création, capacité et disponibilité', async () => {
    const arrival = addDays(hotelToday(), 60);
    const departure = addDays(hotelToday(), 63);
    const q = `/v1/reservations/quote?room_type_id=${types.DBL}&arrival_date=${arrival}&departure_date=${departure}&adults=2&children=1&board=full_board`;
    const quote = await http().get(q).set(auth(reception)).expect(200);
    // 3 nuits × (9 500 + 4 500 × 3)
    expect(quote.body).toMatchObject({ nights: 3, totalAmount: 69000, currency: 'EUR', fitsCapacity: false, available: 4 });

    const ok = await http().get(q.replace('children=1', 'children=0')).set(auth(reception)).expect(200);
    const created = await book(newReservation({ arrivalDate: arrival, departureDate: departure, board: 'full_board' })).expect(201);
    expect(created.body.totalAmount).toBe(ok.body.totalAmount);

    // En modification, la réservation elle-même ne compte pas dans le stock.
    const excl = await http().get(`${q}&exclude_reservation_id=${created.body.id}`).set(auth(reception)).expect(200);
    expect(excl.body.available).toBe(4);
    await http().get(q).set(auth(housekeeping)).expect(403);
  });

  it('historique : création, modification et annulation avec leur auteur', async () => {
    const created = await book(
      newReservation({ arrivalDate: addDays(hotelToday(), 70), departureDate: addDays(hotelToday(), 72) }),
    ).expect(201);
    const url = `/v1/reservations/${created.body.id}`;
    await http().patch(url).set(auth(reception)).set('If-Match', '"1"').send({ adults: 1 }).expect(200);
    await http().post(`${url}/cancel`).set(auth(reception)).send({ reason: 'Changement de programme' }).expect(200);

    const res = await http().get(`${url}/history`).set(auth(reception)).expect(200);
    expect(res.body.data.map((h: { action: string }) => h.action)).toEqual([
      'reservation.created', 'reservation.modified', 'reservation.cancelled',
    ]);
    expect(res.body.data[0].actor.name).toBe('Réception');
    expect(res.body.data[1].data).toMatchObject({ before: { adults: 2 }, after: { adults: 1 } });
    expect(res.body.data[2].data.reason).toBe('Changement de programme');
  });
});
