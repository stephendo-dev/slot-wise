import { Test } from '@nestjs/testing';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import argon2 from 'argon2';
import { AppModule } from '../src/app.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { DatabaseService } from '../src/db/database.service.js';
import { sessions, users } from '../src/db/schema.js';
import { Roles } from '../src/auth/roles.decorator.js';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { SessionGuard } from '../src/auth/session.guard.js';

@Controller('test-only')
@UseGuards(SessionGuard, RolesGuard)
class OwnerOnlyController {
  @Get('owner')
  @Roles('owner')
  owner() {
    return { ok: true };
  }
}

const PASSWORD = 'correct horse battery';

function newSignup(overrides: Record<string, unknown> = {}) {
  const id = randomUUID().slice(0, 8);
  return {
    email: `owner-${id}@example.com`,
    password: PASSWORD,
    businessName: `Luna ${id}`,
    slug: `luna-${id}`,
    timeZone: 'Asia/Ho_Chi_Minh',
    ...overrides,
  };
}

describe('Auth and sessions (HTTP)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
      controllers: [OwnerOnlyController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    database = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  function sessionCookie(res: request.Response): string {
    const header = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const cookie = header.find((c) => c.startsWith('sw_session='));
    if (!cookie) throw new Error('no session cookie was set');
    return cookie;
  }

  const cookieHeader = (setCookie: string) => setCookie.split(';')[0]!;

  async function signUp(overrides: Record<string, unknown> = {}) {
    const body = newSignup(overrides);
    const res = await http().post('/auth/signup').send(body).expect(201);
    return { body, res, cookie: cookieHeader(sessionCookie(res)) };
  }

  describe('sign-up', () => {
    it('creates the user, the business and the owner role, and signs the user in', async () => {
      const { body, res, cookie } = await signUp();

      expect(res.body.user).toMatchObject({ email: body.email, role: 'owner' });
      expect(res.body.business).toMatchObject({
        slug: body.slug,
        name: body.businessName,
        timeZone: 'Asia/Ho_Chi_Minh',
      });

      const me = await http().get('/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body).toEqual(res.body);
    });

    it('sets a session cookie that is httpOnly, Secure and SameSite=Lax', async () => {
      const { res } = await signUp();
      const flags = sessionCookie(res).toLowerCase();
      expect(flags).toContain('httponly');
      expect(flags).toContain('secure');
      expect(flags).toContain('samesite=lax');
      expect(flags).toContain('path=/');
      expect(flags).toContain('max-age=604800');
    });

    it('stores the password as an argon2id hash, and the session as a hash of the cookie value', async () => {
      const { body, cookie } = await signUp();
      const [row] = await database.db
        .select()
        .from(users)
        .where(eq(users.email, body.email));
      expect(row!.passwordHash).toMatch(/^\$argon2id\$/);
      expect(row!.passwordHash).not.toContain(PASSWORD);
      expect(await argon2.verify(row!.passwordHash, PASSWORD)).toBe(true);

      const token = cookie.split('=')[1]!;
      const stored = await database.db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, row!.id));
      expect(stored).toHaveLength(1);
      expect(stored[0]!.tokenHash).not.toBe(token);
    });

    it('builds the slug from the business name when none is given', async () => {
      const name = `Maple Salon ${randomUUID().slice(0, 6)}`;
      const { res } = await signUp({ businessName: name, slug: undefined });
      expect(res.body.business.slug).toBe(
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      );
    });

    it('refuses a taken email, naming the email', async () => {
      const { body } = await signUp();
      const res = await http()
        .post('/auth/signup')
        .send(newSignup({ email: body.email.toUpperCase() }))
        .expect(409);
      expect(res.body.message).toMatch(/email/i);
    });

    it('refuses a taken slug, naming the slug', async () => {
      const { body } = await signUp();
      const res = await http()
        .post('/auth/signup')
        .send(newSignup({ slug: body.slug }))
        .expect(409);
      expect(res.body.message).toMatch(/address|slug/i);
    });

    it('leaves nothing behind when the slug is taken', async () => {
      const { body } = await signUp();
      const second = newSignup({ slug: body.slug });
      await http().post('/auth/signup').send(second).expect(409);
      const rows = await database.db
        .select()
        .from(users)
        .where(eq(users.email, second.email));
      expect(rows).toHaveLength(0);
    });

    it.each([
      ['a short password', { password: 'short' }],
      ['a bad email', { email: 'not-an-email' }],
      ['an unknown time zone', { timeZone: 'Mars/Olympus' }],
      ['a malformed slug', { slug: 'Not A Slug!' }],
    ])('rejects %s with 400', async (_name, overrides) => {
      await http().post('/auth/signup').send(newSignup(overrides)).expect(400);
    });
  });

  describe('login and logout', () => {
    it('logs in with the right credentials', async () => {
      const { body } = await signUp();
      const res = await http()
        .post('/auth/login')
        .send({ email: body.email, password: PASSWORD })
        .expect(200);
      expect(res.body.user.email).toBe(body.email);
      await http()
        .get('/auth/me')
        .set('Cookie', cookieHeader(sessionCookie(res)))
        .expect(200);
    });

    it('refuses a wrong password and an unknown email in the same words', async () => {
      const { body } = await signUp();
      const wrongPassword = await http()
        .post('/auth/login')
        .send({ email: body.email, password: 'wrong password!' })
        .expect(401);
      const unknownEmail = await http()
        .post('/auth/login')
        .send({
          email: `nobody-${randomUUID()}@example.com`,
          password: PASSWORD,
        })
        .expect(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });

    it('rate-limits repeated failures, and a later correct password is refused too', async () => {
      const { body } = await signUp();
      const attempt = (password: string) =>
        http().post('/auth/login').send({ email: body.email, password });

      for (let i = 0; i < 5; i++) await attempt('wrong password!').expect(401);
      await attempt('wrong password!').expect(429);
      await attempt(PASSWORD).expect(429);
    });

    it('does not let one account’s failures block another', async () => {
      const a = await signUp();
      const b = await signUp();
      for (let i = 0; i < 6; i++) {
        await http()
          .post('/auth/login')
          .send({ email: a.body.email, password: 'wrong password!' });
      }
      await http()
        .post('/auth/login')
        .send({ email: b.body.email, password: PASSWORD })
        .expect(200);
    });

    it('ends the session on logout and clears the cookie', async () => {
      const { cookie } = await signUp();
      const out = await http()
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(204);
      expect(sessionCookie(out).toLowerCase()).toMatch(/expires=|max-age=0/);
      await http().get('/auth/me').set('Cookie', cookie).expect(401);
    });

    it('refuses an unknown, a missing and an expired session', async () => {
      await http().get('/auth/me').expect(401);
      await http()
        .get('/auth/me')
        .set('Cookie', `sw_session=${randomUUID()}`)
        .expect(401);

      const { body, cookie } = await signUp();
      const [user] = await database.db
        .select()
        .from(users)
        .where(eq(users.email, body.email));
      await database.db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(sessions.userId, user!.id));
      await http().get('/auth/me').set('Cookie', cookie).expect(401);
    });
  });

  describe('business scope', () => {
    it('returns the signed-in business, and 404 for any other business', async () => {
      const mine = await signUp();
      const theirs = await signUp();
      const myId = mine.res.body.business.id;
      const theirId = theirs.res.body.business.id;

      await http()
        .get(`/businesses/${myId}`)
        .set('Cookie', mine.cookie)
        .expect(200)
        .expect((res) => expect(res.body.slug).toBe(mine.body.slug));

      await http()
        .get(`/businesses/${theirId}`)
        .set('Cookie', mine.cookie)
        .expect(404);
      await http()
        .get(`/businesses/${randomUUID()}`)
        .set('Cookie', mine.cookie)
        .expect(404);
      await http()
        .get('/businesses/not-a-uuid')
        .set('Cookie', mine.cookie)
        .expect(404);
    });

    it('needs a session', async () => {
      const { res } = await signUp();
      await http().get(`/businesses/${res.body.business.id}`).expect(401);
    });
  });

  describe('roles', () => {
    it('lets an owner through a route that needs the owner role', async () => {
      const { cookie } = await signUp();
      await http().get('/test-only/owner').set('Cookie', cookie).expect(200);
    });

    it('refuses a staff user on that route with 403, and a visitor with 401', async () => {
      const { res } = await signUp();
      const email = `staff-${randomUUID().slice(0, 8)}@example.com`;
      await database.db.insert(users).values({
        email,
        passwordHash: await argon2.hash(PASSWORD),
        role: 'staff',
        businessId: res.body.business.id,
      });
      const login = await http()
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      expect(login.body.user.role).toBe('staff');

      await http()
        .get('/test-only/owner')
        .set('Cookie', cookieHeader(sessionCookie(login)))
        .expect(403);
      await http().get('/test-only/owner').expect(401);
    });
  });
});
