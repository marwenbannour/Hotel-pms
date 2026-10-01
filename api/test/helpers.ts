import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { authenticator } from 'otplib';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { seed, DEMO_PASSWORD } from '../src/database/seed-data';

export async function createTestApp(): Promise<{ app: INestApplication; ds: DataSource }> {
  const reset = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL });
  await reset.initialize();
  await reset.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await reset.destroy();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  const ds = app.get(DataSource);
  await seed(ds);
  return { app, ds };
}

export async function login(app: INestApplication, email: string, password = DEMO_PASSWORD) {
  const res = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password }).expect(200);
  return res.body as { accessToken: string; refreshToken: string; mfaEnrollmentRequired: boolean };
}

/** Connexion d'un profil soumis à MFA : enrôlement si nécessaire, puis second facteur. */
export async function loginWithMfa(app: INestApplication, email: string): Promise<string> {
  const http = () => request(app.getHttpServer());
  let res = await http().post('/v1/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200);
  if (res.body.mfaEnrollmentRequired) {
    const setup = await http().post('/v1/me/mfa/setup').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200);
    await http()
      .post('/v1/me/mfa/enable')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .send({ code: authenticator.generate(setup.body.secret) })
      .expect(200);
    res = await http().post('/v1/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200);
  }
  const { mfaToken } = res.body;
  const ds = app.get(DataSource);
  const [{ mfa_secret }] = await ds.query('SELECT mfa_secret FROM users WHERE email = $1', [email]);
  const verified = await http().post('/v1/auth/mfa/verify').send({ mfaToken, code: authenticator.generate(mfa_secret) }).expect(200);
  return verified.body.accessToken;
}
