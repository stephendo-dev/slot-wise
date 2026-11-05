import { and, eq } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { createApp } from './helpers.js';
import { bookings, businesses } from '../src/db/schema.js';

const everyDay = {
  ranges: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    start: '09:00',
    end: '17:00',
  })),
};

describe('Public booking (HTTP)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    ctx = await createApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const as = (cookie: string) => ({ Cookie: cookie });

  /** A business with `staffCount` staff who all work 09:00-17:00 every day and perform one 60-minute service. */
  async function setup(staffCount = 2) {
    const owner = await ctx.signUp();
    const staff: { id: string; name: string }[] = [];
    for (let i = 0; i < staffCount; i++) {
      const res = await ctx
        .http()
        .post('/staff')
        .set(as(owner.cookie))
        .send({ name: `Staff ${String.fromCharCode(65 + i)}` })
        .expect(201);
      await ctx
        .http()
        .put(`/staff/${res.body.id}/hours`)
        .set(as(owner.cookie))
        .send(everyDay)
        .expect(204);
      staff.push({ id: res.body.id, name: res.body.name });
    }
    const service = await ctx
      .http()
      .post('/services')
      .set(as(owner.cookie))
      .send({ name: 'Haircut', durationMinutes: 60, priceCents: 3500 })
      .expect(201);
    await ctx
      .http()
      .put(`/services/${service.body.id}/staff`)
      .set(as(owner.cookie))
      .send({ staffIds: staff.map((s) => s.id) })
      .expect(204);
    return {
      owner,
      staff,
      serviceId: service.body.id as string,
      slug: owner.body.slug as string,
    };
  }

  const customer = (overrides: Record<string, unknown> = {}) => ({
    name: 'Linh Nguyen',
    email: 'linh@example.com',
    phone: '+84 90 123 4567',
    ...overrides,
  });

  async function slots(
    slug: string,
    serviceId: string,
    staffId?: string,
  ): Promise<string[]> {
    const res = await ctx
      .http()
      .get(`/public/b/${slug}/slots`)
      .query({ serviceId, ...(staffId ? { staffId } : {}) })
      .expect(200);
    return res.body.slots;
  }

  const book = (slug: string, body: Record<string, unknown>) =>
    ctx.http().post(`/public/b/${slug}/bookings`).send(body);

  describe('the booking page data', () => {
    it('lists active services with their active staff, and hides archived ones', async () => {
      const { owner, staff, slug, serviceId } = await setup(2);
      await ctx
        .http()
        .post(`/staff/${staff[1]!.id}/archive`)
        .set(as(owner.cookie))
        .expect(204);
      const hidden = await ctx
        .http()
        .post('/services')
        .set(as(owner.cookie))
        .send({ name: 'Old', durationMinutes: 30, priceCents: 0 })
        .expect(201);
      await ctx
        .http()
        .put(`/services/${hidden.body.id}/staff`)
        .set(as(owner.cookie))
        .send({ staffIds: [staff[0]!.id] })
        .expect(204);
      await ctx
        .http()
        .post(`/services/${hidden.body.id}/archive`)
        .set(as(owner.cookie))
        .expect(204);

      const res = await ctx.http().get(`/public/b/${slug}`).expect(200);
      expect(res.body.services).toEqual([
        {
          id: serviceId,
          name: 'Haircut',
          durationMinutes: 60,
          priceCents: 3500,
          staff: [{ id: staff[0]!.id, name: 'Staff A' }],
        },
      ]);
      await ctx.http().get('/public/b/no-such-business').expect(404);
    });
  });

  describe('slots', () => {
    it('are on a 15-minute grid, at least an hour away, within 30 days and sorted', async () => {
      const { slug, serviceId } = await setup(1);
      const list = await slots(slug, serviceId);
      expect(list.length).toBeGreaterThan(100);
      const times = list.map((iso) => Date.parse(iso));
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(times[0]).toBeGreaterThanOrEqual(Date.now() + 59 * 60_000);
      expect(times.at(-1)).toBeLessThan(Date.now() + 31 * 24 * 3600_000);
      expect(times.every((ms) => ms % (15 * 60_000) === 0)).toBe(true);
    });

    it('refuse an archived service, an unknown staff member and a staff member who does not perform it', async () => {
      const { owner, staff, slug, serviceId } = await setup(2);
      const other = await ctx
        .http()
        .post('/staff')
        .set(as(owner.cookie))
        .send({ name: 'Not linked' })
        .expect(201);
      await ctx
        .http()
        .get(`/public/b/${slug}/slots`)
        .query({ serviceId: randomUUID() })
        .expect(404);
      await ctx
        .http()
        .get(`/public/b/${slug}/slots`)
        .query({ serviceId, staffId: randomUUID() })
        .expect(404);
      await ctx
        .http()
        .get(`/public/b/${slug}/slots`)
        .query({ serviceId, staffId: other.body.id })
        .expect(404);
      await ctx
        .http()
        .get(`/public/b/${slug}/slots`)
        .query({ serviceId: 'nope' })
        .expect(404);
      await ctx
        .http()
        .post(`/services/${serviceId}/archive`)
        .set(as(owner.cookie))
        .expect(204);
      await ctx
        .http()
        .get(`/public/b/${slug}/slots`)
        .query({ serviceId, staffId: staff[0]!.id })
        .expect(404);
    });
  });

  describe('booking', () => {
    it('confirms a slot, shows it through the private link, removes it from the slots, and exposes no customer data', async () => {
      const { staff, slug, serviceId } = await setup(2);
      const [first] = await slots(slug, serviceId, staff[0]!.id);

      const res = await book(slug, {
        serviceId,
        staffId: staff[0]!.id,
        start: first,
        ...customer(),
      }).expect(201);
      expect(res.body.booking).toMatchObject({
        service: 'Haircut',
        staff: 'Staff A',
        start: first,
        status: 'confirmed',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      expect(res.body.manageToken).toEqual(expect.any(String));

      expect(await slots(slug, serviceId, staff[0]!.id)).not.toContain(first);
      expect(await slots(slug, serviceId, staff[1]!.id)).toContain(first);

      const view = await ctx
        .http()
        .get(`/public/bookings/${res.body.manageToken}`)
        .expect(200);
      expect(view.body).toEqual(res.body.booking);

      const everything = JSON.stringify([
        (await ctx.http().get(`/public/b/${slug}`)).body,
        await slots(slug, serviceId),
      ]);
      expect(everything).not.toContain('linh@example.com');
      expect(everything).not.toContain('Linh');
      expect(everything).not.toContain('84 90');
    });

    it('stores only a hash of the manage token', async () => {
      const { staff, slug, serviceId } = await setup(1);
      const [first] = await slots(slug, serviceId);
      const res = await book(slug, {
        serviceId,
        staffId: staff[0]!.id,
        start: first,
        ...customer(),
      }).expect(201);
      const [row] = await ctx.database.db
        .select()
        .from(bookings)
        .innerJoin(businesses, eq(bookings.businessId, businesses.id))
        .where(eq(businesses.slug, slug));
      expect(row!.bookings.manageTokenHash).toBe(
        createHash('sha256').update(res.body.manageToken).digest('hex'),
      );
      expect(row!.bookings.manageTokenHash).not.toBe(res.body.manageToken);
    });

    it.each([
      ['no name', { name: ' ' }],
      ['a bad email', { email: 'nope' }],
      ['a bad phone', { phone: 'abc' }],
      ['a start that is not a time', { start: 'tomorrow' }],
    ])('rejects %s with 400', async (_label, change) => {
      const { staff, slug, serviceId } = await setup(1);
      const [first] = await slots(slug, serviceId);
      await book(slug, {
        serviceId,
        staffId: staff[0]!.id,
        start: first,
        ...customer(),
        ...change,
      }).expect(400);
    });

    it('refuses a start that is not an offered slot', async () => {
      const { staff, slug, serviceId } = await setup(1);
      const [first] = await slots(slug, serviceId);
      const offGrid = new Date(Date.parse(first!) + 5 * 60_000).toISOString();
      const past = new Date(Date.now() - 3600_000).toISOString();
      for (const start of [offGrid, past]) {
        const res = await book(slug, {
          serviceId,
          staffId: staff[0]!.id,
          start,
          ...customer(),
        }).expect(409);
        expect(res.body.message).toMatch(/just taken/i);
      }
    });

    it('lets exactly one of two simultaneous bookings of the same staff and time succeed', async () => {
      const { staff, slug, serviceId } = await setup(1);
      const [first] = await slots(slug, serviceId);
      const body = {
        serviceId,
        staffId: staff[0]!.id,
        start: first,
        ...customer(),
      };
      const results = await Promise.all([
        book(slug, body),
        book(slug, { ...body, name: 'Second' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const loser = results.find((r) => r.status === 409)!;
      expect(loser.body.message).toMatch(/just taken/i);
      const rows = await ctx.database.db
        .select()
        .from(bookings)
        .where(eq(bookings.staffId, staff[0]!.id));
      expect(rows).toHaveLength(1);
    });

    it('refuses an overlapping time of the same staff member, even a different start', async () => {
      const { staff, slug, serviceId } = await setup(1);
      const [first] = await slots(slug, serviceId);
      const body = { serviceId, staffId: staff[0]!.id, ...customer() };
      await book(slug, { ...body, start: first }).expect(201);
      const overlapping = new Date(
        Date.parse(first!) + 30 * 60_000,
      ).toISOString();
      await book(slug, { ...body, start: overlapping }).expect(409);
    });

    it('is refused by the database itself when two confirmed bookings overlap, but a cancelled one does not block', async () => {
      const { staff, slug, serviceId } = await setup(1);
      const [business] = await ctx.database.db
        .select()
        .from(businesses)
        .where(eq(businesses.slug, slug));
      const start = new Date(Date.now() + 5 * 24 * 3600_000);
      const row = (
        offsetMinutes: number,
        status: 'confirmed' | 'cancelled',
      ) => ({
        businessId: business!.id,
        staffId: staff[0]!.id,
        serviceId,
        startAt: new Date(start.getTime() + offsetMinutes * 60_000),
        endAt: new Date(start.getTime() + (offsetMinutes + 60) * 60_000),
        customerName: 'x',
        customerEmail: 'x@example.com',
        customerPhone: '123456',
        status,
        manageTokenHash: randomUUID(),
      });
      await ctx.database.db.insert(bookings).values(row(0, 'confirmed'));
      await expect(
        ctx.database.db.insert(bookings).values(row(30, 'confirmed')),
      ).rejects.toThrow();
      await ctx.database.db.insert(bookings).values(row(30, 'cancelled'));
      await ctx.database.db.insert(bookings).values(row(60, 'confirmed'));
    });
  });

  describe('"anyone"', () => {
    it('shows a time when at least one qualified staff member is free', async () => {
      const { staff, slug, serviceId } = await setup(2);
      const both = await slots(slug, serviceId);
      const [first] = both;
      await book(slug, {
        serviceId,
        staffId: staff[0]!.id,
        start: first,
        ...customer(),
      }).expect(201);
      expect(await slots(slug, serviceId)).toContain(first); // staff B is still free
      await book(slug, {
        serviceId,
        staffId: staff[1]!.id,
        start: first,
        ...customer(),
      }).expect(201);
      expect(await slots(slug, serviceId)).not.toContain(first); // nobody is free
    });

    it('books the free staff member with the fewest bookings that day', async () => {
      const { staff, slug, serviceId } = await setup(2);
      const list = await slots(slug, serviceId);
      // Three times on the same local day (Vietnam time is UTC+7).
      const day = (iso: string) =>
        new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);
      const sameDay = list.filter((iso) => day(iso) === day(list[0]!));
      const [a, b, c] = [sameDay[0]!, sameDay[4]!, sameDay[8]!];
      // Staff A has two bookings that day, staff B has none.
      await book(slug, {
        serviceId,
        staffId: staff[0]!.id,
        start: a,
        ...customer(),
      }).expect(201);
      await book(slug, {
        serviceId,
        staffId: staff[0]!.id,
        start: b,
        ...customer(),
      }).expect(201);
      const res = await book(slug, {
        serviceId,
        start: c,
        ...customer(),
      }).expect(201);
      expect(res.body.booking.staff).toBe('Staff B');
      // Now B has one and A has two: B is still the least busy, so B again at a free time.
      const next = sameDay[12]!;
      const again = await book(slug, {
        serviceId,
        start: next,
        ...customer(),
      }).expect(201);
      expect(again.body.booking.staff).toBe('Staff B');
    });

    it('falls back to the other staff member when one is taken at that time', async () => {
      const { staff, slug, serviceId } = await setup(2);
      const [first] = await slots(slug, serviceId);
      await book(slug, {
        serviceId,
        staffId: staff[0]!.id,
        start: first,
        ...customer(),
      }).expect(201);
      const res = await book(slug, {
        serviceId,
        start: first,
        ...customer(),
      }).expect(201);
      expect(res.body.booking.staff).toBe('Staff B');
      await book(slug, { serviceId, start: first, ...customer() }).expect(409);
    });
  });

  describe('the private link', () => {
    it('cancels the booking, and the slot becomes free again', async () => {
      const { staff, slug, serviceId } = await setup(1);
      const [first] = await slots(slug, serviceId);
      const res = await book(slug, {
        serviceId,
        staffId: staff[0]!.id,
        start: first,
        ...customer(),
      }).expect(201);
      expect(await slots(slug, serviceId)).not.toContain(first);

      const cancelled = await ctx
        .http()
        .post(`/public/bookings/${res.body.manageToken}/cancel`)
        .expect(200);
      expect(cancelled.body.status).toBe('cancelled');
      expect(await slots(slug, serviceId)).toContain(first);
      const view = await ctx
        .http()
        .get(`/public/bookings/${res.body.manageToken}`)
        .expect(200);
      expect(view.body.status).toBe('cancelled');
      await ctx
        .http()
        .post(`/public/bookings/${res.body.manageToken}/cancel`)
        .expect(200);
      await book(slug, {
        serviceId,
        staffId: staff[0]!.id,
        start: first,
        ...customer(),
      }).expect(201);
    });

    it('cannot cancel a booking that has started, and knows no unknown token', async () => {
      const { staff, slug, serviceId } = await setup(1);
      const [business] = await ctx.database.db
        .select()
        .from(businesses)
        .where(eq(businesses.slug, slug));
      const token = `past-${randomUUID()}`;
      await ctx.database.db.insert(bookings).values({
        businessId: business!.id,
        staffId: staff[0]!.id,
        serviceId,
        startAt: new Date(Date.now() - 30 * 60_000),
        endAt: new Date(Date.now() + 30 * 60_000),
        customerName: 'x',
        customerEmail: 'x@example.com',
        customerPhone: '123456',
        manageTokenHash: createHash('sha256').update(token).digest('hex'),
      });
      await ctx.http().post(`/public/bookings/${token}/cancel`).expect(409);
      const [row] = await ctx.database.db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.staffId, staff[0]!.id),
            eq(bookings.status, 'confirmed'),
          ),
        );
      expect(row).toBeDefined();
      await ctx.http().get('/public/bookings/unknown').expect(404);
      await ctx.http().post('/public/bookings/unknown/cancel').expect(404);
    });
  });
});
