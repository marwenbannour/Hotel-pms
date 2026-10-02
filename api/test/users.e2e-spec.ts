import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, login, loginWithMfa } from './helpers';

let app: INestApplication;
let ds: DataSource;
let admin: string;
let itTech: string;
let reception: string;
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const idOf = async (email: string) => (await ds.query(`SELECT id FROM users WHERE email = $1`, [email]))[0].id as string;

beforeAll(async () => {
  ({ app, ds } = await createTestApp());
  admin = await loginWithMfa(app, 'admin@hotel.local');
  itTech = await loginWithMfa(app, 'it@hotel.local');
  reception = (await login(app, 'reception@hotel.local')).accessToken;
});

afterAll(() => app.close());

describe('Utilisateurs', () => {
  it('réservé à admin:users, sans hash ni secret dans les réponses', async () => {
    await http().get('/v1/users').set(auth(reception)).expect(403);
    const res = await http().get('/v1/users').set(auth(itTech)).expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(6);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/password|mfaSecret|mfa_secret/i);
    expect(res.body.data.find((u: { email: string }) => u.email === 'admin@hotel.local')).toMatchObject({ role: 'admin', mfaRequired: true, active: true });
  });

  it('création : mot de passe de 12 caractères minimum, email unique, connexion possible', async () => {
    const base = { email: 'nadia@hotel.local', fullName: 'Nadia Haddad', role: 'reception' };
    await http().post('/v1/users').set(auth(itTech)).send({ ...base, password: 'court' }).expect(422);
    const created = await http().post('/v1/users').set(auth(itTech)).send({ ...base, password: 'Une phrase de passe' }).expect(201);
    expect(created.body).toMatchObject({ email: 'nadia@hotel.local', role: 'reception', locale: 'fr', active: true, mfaEnabled: false });
    await http().post('/v1/users').set(auth(itTech)).send({ ...base, email: 'NADIA@hotel.local', password: 'Une phrase de passe' }).expect(409);
    await login(app, 'nadia@hotel.local', 'Une phrase de passe');
  });

  it('le profil IT ne peut ni créer, ni modifier, ni promouvoir un administrateur', async () => {
    const nadia = await idOf('nadia@hotel.local');
    const adminId = await idOf('admin@hotel.local');
    await http().post('/v1/users').set(auth(itTech)).send({ email: 'boss@hotel.local', fullName: 'Boss', role: 'admin', password: 'Une phrase de passe' }).expect(403);
    await http().patch(`/v1/users/${nadia}`).set(auth(itTech)).send({ role: 'admin' }).expect(403);
    await http().patch(`/v1/users/${adminId}`).set(auth(itTech)).send({ fullName: 'Piraté' }).expect(403);
    await http().post(`/v1/users/${adminId}/password`).set(auth(itTech)).send({ password: 'Une autre phrase' }).expect(403);
    await http().post(`/v1/users/${adminId}/mfa/reset`).set(auth(itTech)).expect(403);
  });

  it('désactivation : connexion refusée et sessions fermées', async () => {
    const nadia = await idOf('nadia@hotel.local');
    const session = await login(app, 'nadia@hotel.local', 'Une phrase de passe');
    await http().patch(`/v1/users/${nadia}`).set(auth(itTech)).send({ active: false }).expect(200);
    await http().post('/v1/auth/login').send({ email: 'nadia@hotel.local', password: 'Une phrase de passe' }).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    await http().patch(`/v1/users/${nadia}`).set(auth(itTech)).send({ active: true }).expect(200);
  });

  it('nouveau mot de passe : l’ancien ne fonctionne plus', async () => {
    const nadia = await idOf('nadia@hotel.local');
    await http().post(`/v1/users/${nadia}/password`).set(auth(itTech)).send({ password: 'Nouvelle phrase secrète' }).expect(200);
    await http().post('/v1/auth/login').send({ email: 'nadia@hotel.local', password: 'Une phrase de passe' }).expect(401);
    await login(app, 'nadia@hotel.local', 'Nouvelle phrase secrète');
    const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'user.password_reset' AND entity_id = $1`, [nadia]);
    expect(n).toBe(1);
  });

  it('pas d’auto-désactivation ni de retrait du dernier administrateur', async () => {
    const adminId = await idOf('admin@hotel.local');
    await http().patch(`/v1/users/${adminId}`).set(auth(admin)).send({ active: false }).expect(409);
    await http().patch(`/v1/users/${adminId}`).set(auth(admin)).send({ role: 'reception' }).expect(409);
    // Un second administrateur ne peut pas retirer le dernier autre.
    const second = await http().post('/v1/users').set(auth(admin)).send({ email: 'dir2@hotel.local', fullName: 'Direction 2', role: 'admin', password: 'Une phrase de passe' }).expect(201);
    await http().patch(`/v1/users/${second.body.id}`).set(auth(admin)).send({ active: false }).expect(200);
    const other = await http().patch(`/v1/users/${second.body.id}`).set(auth(admin)).send({ active: true }).expect(200);
    expect(other.body.active).toBe(true);
  });

  it('réinitialisation MFA : réenrôlement exigé à la connexion suivante', async () => {
    const itId = await idOf('it@hotel.local');
    const res = await http().post(`/v1/users/${itId}/mfa/reset`).set(auth(admin)).expect(200);
    expect(res.body).toMatchObject({ mfaEnabled: false, mfaRequired: true });
    const next = await login(app, 'it@hotel.local');
    expect(next.mfaEnrollmentRequired).toBe(true);
  });
});
