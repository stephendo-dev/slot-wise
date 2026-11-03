import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import argon2 from 'argon2';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/db/database.service.js';
import { users } from '../src/db/schema.js';

export const PASSWORD = 'correct horse battery';

export async function createApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication<App> = moduleRef.createNestApplication();
  await app.init();
  const database = app.get(DatabaseService);
  const http = () => request(app.getHttpServer());

  const cookieOf = (res: request.Response): string => {
    const header = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const cookie = header.find((c) => c.startsWith('sw_session='));
    if (!cookie) throw new Error('no session cookie was set');
    return cookie.split(';')[0]!;
  };

  async function signUp(overrides: Record<string, unknown> = {}) {
    const id = randomUUID().slice(0, 8);
    const body = {
      email: `owner-${id}@example.com`,
      password: PASSWORD,
      businessName: `Salon ${id}`,
      slug: `salon-${id}`,
      timeZone: 'Asia/Ho_Chi_Minh',
      ...overrides,
    };
    const res = await http().post('/auth/signup').send(body).expect(201);
    return {
      body,
      cookie: cookieOf(res),
      businessId: res.body.business.id as string,
      userId: res.body.user.id as string,
    };
  }

  /** A staff member with a login, created through the owner's endpoint. */
  async function addStaff(owner: { cookie: string }, name = 'Mai') {
    const email = `staff-${randomUUID().slice(0, 8)}@example.com`;
    const res = await http()
      .post('/staff')
      .set('Cookie', owner.cookie)
      .send({ name, email, password: PASSWORD })
      .expect(201);
    const login = await http()
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return { id: res.body.id as string, email, cookie: cookieOf(login) };
  }

  const hash = (password: string) => argon2.hash(password);
  return { app, http, database, cookieOf, signUp, addStaff, hash, users };
}
