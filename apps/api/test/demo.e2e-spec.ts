import { and, count, eq } from 'drizzle-orm';
import { createApp, PASSWORD } from './helpers.js';
import { bookings, businesses, users } from '../src/db/schema.js';

describe('Demo salon and account (HTTP)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  const SECRET = 'test-reset-secret';

  beforeAll(async () => {
    process.env.DEMO_RESET_SECRET = SECRET;
    ctx = await createApp();
  });
  afterAll(async () => {
    delete process.env.DEMO_RESET_SECRET;
    await ctx.app.close();
  });

  const as = (cookie: string) => ({ Cookie: cookie });

  async function demoLogin() {
    const res = await ctx.http().post('/demo/login').expect(200);
    return { res, cookie: ctx.cookieOf(res) };
  }

  async function bookingCount(cookie: string): Promise<number> {
    let total = 0;
    for (let offset = 0; offset < 16; offset++) {
      const date = new Date(Date.now() + offset * 24 * 3600_000 + 7 * 3600_000)
        .toISOString()
        .slice(0, 10);
      const day = await ctx
        .http()
        .get('/bookings')
        .query({ date })
        .set(as(cookie))
        .expect(200);
      for (const group of day.body.groups) {
        total += group.bookings.filter(
          (b: { status: string }) => b.status === 'confirmed',
        ).length;
      }
    }
    return total;
  }

  describe('"Try as business owner"', () => {
    it('signs the visitor in as the demo owner with no form, in a seeded salon', async () => {
      const { res, cookie } = await demoLogin();
      expect(res.body.user).toMatchObject({ role: 'owner', isDemo: true });
      expect(res.body.business).toMatchObject({
        slug: 'luna-hair-studio',
        name: 'Luna Hair Studio',
      });

      const staff = await ctx.http().get('/staff').set(as(cookie)).expect(200);
      const services = await ctx
        .http()
        .get('/services')
        .set(as(cookie))
        .expect(200);
      expect(staff.body.map((s: { name: string }) => s.name).sort()).toEqual([
        'An',
        'Linh',
        'Mai',
      ]);
      expect(services.body).toHaveLength(5);
      expect(
        staff.body.every((s: { hours: unknown[] }) => s.hours.length === 5),
      ).toBe(true);

      const total = await bookingCount(cookie);
      expect(total).toBeGreaterThanOrEqual(38);
      expect(total).toBeLessThanOrEqual(42);
    });

    it('can be used twice without making a second salon', async () => {
      await demoLogin();
      await demoLogin();
      const rows = await ctx.database.db
        .select()
        .from(businesses)
        .where(eq(businesses.slug, 'luna-hair-studio'));
      expect(rows).toHaveLength(1);
      const [{ n }] = await ctx.database.db
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.isDemo, true)));
      expect(n).toBe(1);
    });

    it('has a public booking page with free slots', async () => {
      await demoLogin();
      const page = await ctx
        .http()
        .get('/public/b/luna-hair-studio')
        .expect(200);
      expect(page.body.services).toHaveLength(5);
      const slots = await ctx
        .http()
        .get('/public/b/luna-hair-studio/slots')
        .query({ serviceId: page.body.services[0].id })
        .expect(200);
      expect(slots.body.slots.length).toBeGreaterThan(50);
    });
  });

  describe('the demo account', () => {
    it('cannot change its password or email, or delete the business', async () => {
      const { cookie } = await demoLogin();
      await ctx
        .http()
        .patch('/account/password')
        .set(as(cookie))
        .send({
          currentPassword: 'whatever',
          newPassword: 'a brand new password',
        })
        .expect(403);
      await ctx
        .http()
        .patch('/account/email')
        .set(as(cookie))
        .send({ email: 'x@example.com', password: 'whatever' })
        .expect(403);
      await ctx
        .http()
        .delete('/account/business')
        .set(as(cookie))
        .send({ password: 'whatever' })
        .expect(403);

      const me = await ctx.http().get('/auth/me').set(as(cookie)).expect(200);
      expect(me.body.user.email).toBe('demo@slotwise.dev');
      expect(me.body.business.slug).toBe('luna-hair-studio');
    });

    it('cannot sign in with a password: there is no usable one', async () => {
      await demoLogin();
      await ctx
        .http()
        .post('/auth/login')
        .send({ email: 'demo@slotwise.dev', password: PASSWORD })
        .expect(401);
    });
  });

  describe('the reset endpoint', () => {
    it('is closed without the secret, and also when no secret is configured', async () => {
      await demoLogin();
      await ctx.http().post('/demo/reset').expect(403);
      await ctx
        .http()
        .post('/demo/reset')
        .set('x-reset-secret', 'wrong')
        .expect(403);

      delete process.env.DEMO_RESET_SECRET;
      await ctx
        .http()
        .post('/demo/reset')
        .set('x-reset-secret', SECRET)
        .expect(404);
      process.env.DEMO_RESET_SECRET = SECRET;
    });

    it('restores the seed: edits are undone and the bookings sit in the coming 14 days', async () => {
      const { cookie } = await demoLogin();
      const before = await bookingCount(cookie);

      // A visitor changes things in the demo salon.
      const services = await ctx.http().get('/services').set(as(cookie));
      await ctx
        .http()
        .post(`/services/${services.body[0].id}/archive`)
        .set(as(cookie))
        .expect(204);
      const staff = await ctx.http().get('/staff').set(as(cookie));
      await ctx
        .http()
        .post(`/staff/${staff.body[0].id}/archive`)
        .set(as(cookie))
        .expect(204);
      const [business] = await ctx.database.db
        .select()
        .from(businesses)
        .where(eq(businesses.slug, 'luna-hair-studio'));
      await ctx.database.db
        .update(bookings)
        .set({ status: 'cancelled' })
        .where(eq(bookings.businessId, business!.id));
      expect(await bookingCount(cookie)).toBe(0);

      const reset = await ctx
        .http()
        .post('/demo/reset')
        .set('x-reset-secret', SECRET)
        .expect(200);
      expect(reset.body.bookings).toBeGreaterThanOrEqual(38);

      // The old session still works: the demo owner and business are kept.
      expect(await bookingCount(cookie)).toBe(reset.body.bookings);
      expect(reset.body.bookings).toBeGreaterThanOrEqual(before - 3);
      const after = await ctx.http().get('/services').set(as(cookie));
      expect(after.body).toHaveLength(5);
      expect(after.body.every((s: { archived: boolean }) => !s.archived)).toBe(
        true,
      );
      const staffAfter = await ctx.http().get('/staff').set(as(cookie));
      expect(
        staffAfter.body.every((s: { archived: boolean }) => !s.archived),
      ).toBe(true);

      const rows = await ctx.database.db
        .select()
        .from(bookings)
        .where(eq(bookings.businessId, business!.id));
      expect(rows.every((r) => r.startAt.getTime() > Date.now())).toBe(true);
      expect(
        rows.every(
          (r) => r.startAt.getTime() < Date.now() + 15 * 24 * 3600_000,
        ),
      ).toBe(true);
    });

    it('twice in a row leaves the same number of bookings, not double', async () => {
      await demoLogin();
      const first = await ctx
        .http()
        .post('/demo/reset')
        .set('x-reset-secret', SECRET)
        .expect(200);
      const second = await ctx
        .http()
        .post('/demo/reset')
        .set('x-reset-secret', SECRET)
        .expect(200);
      expect(second.body.bookings).toBe(first.body.bookings);
      const [business] = await ctx.database.db
        .select()
        .from(businesses)
        .where(eq(businesses.slug, 'luna-hair-studio'));
      const [{ n }] = await ctx.database.db
        .select({ n: count() })
        .from(bookings)
        .where(eq(bookings.businessId, business!.id));
      expect(n).toBe(second.body.bookings);
    });
  });

  describe('a normal account', () => {
    it('changes its password with the current one, signs other devices out and keeps this one', async () => {
      const owner = await ctx.signUp();
      const other = await ctx
        .http()
        .post('/auth/login')
        .send({ email: owner.body.email, password: PASSWORD })
        .expect(200);
      const otherCookie = ctx.cookieOf(other);

      await ctx
        .http()
        .patch('/account/password')
        .set(as(owner.cookie))
        .send({
          currentPassword: 'not the password',
          newPassword: 'a brand new password',
        })
        .expect(400);
      await ctx
        .http()
        .patch('/account/password')
        .set(as(owner.cookie))
        .send({
          currentPassword: PASSWORD,
          newPassword: 'a brand new password',
        })
        .expect(204);

      await ctx.http().get('/auth/me').set(as(owner.cookie)).expect(200);
      await ctx.http().get('/auth/me').set(as(otherCookie)).expect(401);
      await ctx
        .http()
        .post('/auth/login')
        .send({ email: owner.body.email, password: PASSWORD })
        .expect(401);
      await ctx
        .http()
        .post('/auth/login')
        .send({ email: owner.body.email, password: 'a brand new password' })
        .expect(200);
    });

    it('changes its email, and refuses one that is taken', async () => {
      const a = await ctx.signUp();
      const b = await ctx.signUp();
      await ctx
        .http()
        .patch('/account/email')
        .set(as(a.cookie))
        .send({ email: b.body.email, password: PASSWORD })
        .expect(409);
      await ctx
        .http()
        .patch('/account/email')
        .set(as(a.cookie))
        .send({ email: 'renamed@example.com', password: 'wrong password' })
        .expect(400);
      const fresh = `renamed-${Date.now()}@example.com`;
      await ctx
        .http()
        .patch('/account/email')
        .set(as(a.cookie))
        .send({ email: fresh, password: PASSWORD })
        .expect(204);
      const me = await ctx.http().get('/auth/me').set(as(a.cookie));
      expect(me.body.user.email).toBe(fresh);
    });

    it('lets an owner delete the business with the password, and refuses a staff user', async () => {
      const owner = await ctx.signUp();
      const staff = await ctx.addStaff(owner);
      await ctx
        .http()
        .delete('/account/business')
        .set(as(staff.cookie))
        .send({ password: PASSWORD })
        .expect(403);
      await ctx
        .http()
        .delete('/account/business')
        .set(as(owner.cookie))
        .send({ password: 'wrong password' })
        .expect(400);
      await ctx
        .http()
        .delete('/account/business')
        .set(as(owner.cookie))
        .send({ password: PASSWORD })
        .expect(204);

      await ctx.http().get('/auth/me').set(as(owner.cookie)).expect(401);
      await ctx.http().get(`/public/b/${owner.body.slug}`).expect(404);
      await ctx
        .http()
        .post('/auth/login')
        .send({ email: owner.body.email, password: PASSWORD })
        .expect(401);
    });

    it('needs a session', async () => {
      await ctx.http().patch('/account/password').send({}).expect(401);
      await ctx.http().delete('/account/business').send({}).expect(401);
    });
  });
});
