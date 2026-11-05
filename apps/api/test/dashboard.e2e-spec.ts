import { randomUUID } from 'node:crypto';
import { createApp } from './helpers.js';

const everyDay = {
  ranges: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    start: '09:00',
    end: '17:00',
  })),
};

// Vietnam time is UTC+7 all year.
const localDate = (iso: string) =>
  new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);

describe('Bookings dashboard and staff view (HTTP)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    ctx = await createApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const as = (cookie: string) => ({ Cookie: cookie });

  /** An owner, two staff with logins (Mai, An) who work every day, one service, and bookings made through the public page. */
  async function setup() {
    const owner = await ctx.signUp();
    const mai = await ctx.addStaff(owner, 'Mai');
    const an = await ctx.addStaff(owner, 'An');
    for (const person of [mai, an]) {
      await ctx
        .http()
        .put(`/staff/${person.id}/hours`)
        .set(as(owner.cookie))
        .send(everyDay)
        .expect(204);
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
      .send({ staffIds: [mai.id, an.id] })
      .expect(204);

    const serviceId = service.body.id as string;
    const slots = (
      await ctx
        .http()
        .get(`/public/b/${owner.body.slug}/slots`)
        .query({ serviceId, staffId: mai.id })
        .expect(200)
    ).body.slots as string[];
    const day = localDate(slots[0]!);
    const sameDay = slots.filter((iso) => localDate(iso) === day);
    const otherDay = slots.find((iso) => localDate(iso) !== day)!;

    const book = async (staffId: string, start: string, name: string) =>
      (
        await ctx
          .http()
          .post(`/public/b/${owner.body.slug}/bookings`)
          .send({
            serviceId,
            staffId,
            start,
            name,
            email: `${name.toLowerCase()}@example.com`,
            phone: '0901234567',
          })
          .expect(201)
      ).body;

    await book(mai.id, sameDay[0]!, 'Zed');
    await book(mai.id, sameDay[8]!, 'Yara');
    await book(an.id, sameDay[4]!, 'Xuan');
    await book(an.id, otherDay, 'Later');
    return { owner, mai, an, day, otherDay, serviceId };
  }

  describe('the owner', () => {
    it('sees every booking of a chosen day grouped by staff, in time order, and none of another day', async () => {
      const { owner, mai, an, day } = await setup();
      const res = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(owner.cookie))
        .expect(200);
      expect(res.body.date).toBe(day);
      expect(res.body.timeZone).toBe('Asia/Ho_Chi_Minh');
      expect(
        res.body.groups.map((g: { staffName: string }) => g.staffName),
      ).toEqual(['An', 'Mai']);
      const byName = Object.fromEntries(
        res.body.groups.map(
          (g: { staffName: string; bookings: { customerName: string }[] }) => [
            g.staffName,
            g.bookings.map((b) => b.customerName),
          ],
        ),
      );
      expect(byName).toEqual({ An: ['Xuan'], Mai: ['Zed', 'Yara'] });
      expect(
        res.body.groups.find((g: { staffId: string }) => g.staffId === mai.id)
          .bookings[0],
      ).toMatchObject({
        service: 'Haircut',
        status: 'confirmed',
        customerEmail: 'zed@example.com',
        customerPhone: '0901234567',
      });
      expect(an.id).toBeDefined();
    });

    it('defaults to today, and refuses a date that is not a date', async () => {
      const { owner } = await setup();
      await ctx.http().get('/bookings').set(as(owner.cookie)).expect(200);
      for (const date of ['tomorrow', '2026-13-45', '2026-1-1']) {
        await ctx
          .http()
          .get('/bookings')
          .query({ date })
          .set(as(owner.cookie))
          .expect(400);
      }
    });

    it('cancels any booking of the business, and its slot is free again', async () => {
      const { owner, mai, day, serviceId } = await setup();
      const list = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(owner.cookie));
      const booking = list.body.groups.find(
        (g: { staffId: string }) => g.staffId === mai.id,
      ).bookings[0];
      await ctx
        .http()
        .post(`/bookings/${booking.id}/cancel`)
        .set(as(owner.cookie))
        .expect(204);
      const after = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(owner.cookie));
      const cancelled = after.body.groups.find(
        (g: { staffId: string }) => g.staffId === mai.id,
      ).bookings[0];
      expect(cancelled).toMatchObject({ id: booking.id, status: 'cancelled' });

      const me = await ctx.http().get('/auth/me').set(as(owner.cookie));
      const slots = (
        await ctx
          .http()
          .get(`/public/b/${me.body.business.slug}/slots`)
          .query({ serviceId, staffId: mai.id })
      ).body.slots as string[];
      expect(slots).toContain(booking.start);
    });
  });

  describe('a staff user', () => {
    it('sees only their own bookings and no one else', async () => {
      const { owner, mai, an, day } = await setup();
      const asMai = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(mai.cookie))
        .expect(200);
      expect(asMai.body.groups).toHaveLength(1);
      expect(asMai.body.groups[0]).toMatchObject({
        staffId: mai.id,
        staffName: 'Mai',
      });
      expect(
        asMai.body.groups[0].bookings.map(
          (b: { customerName: string }) => b.customerName,
        ),
      ).toEqual(['Zed', 'Yara']);

      const asAn = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(an.cookie))
        .expect(200);
      expect(
        asAn.body.groups.map((g: { staffId: string }) => g.staffId),
      ).toEqual([an.id]);
      expect(JSON.stringify(asAn.body)).not.toContain('Zed');
      expect(owner.cookie).toBeDefined();
    });

    it('cannot cancel a booking, and cannot reach any management page', async () => {
      const { owner, mai, day } = await setup();
      const list = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(owner.cookie));
      const booking = list.body.groups[1].bookings[0];
      await ctx
        .http()
        .post(`/bookings/${booking.id}/cancel`)
        .set(as(mai.cookie))
        .expect(403);
      await ctx.http().get('/staff').set(as(mai.cookie)).expect(403);
      await ctx.http().get('/services').set(as(mai.cookie)).expect(403);
      const after = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(owner.cookie));
      expect(after.body.groups[1].bookings[0].status).toBe('confirmed');
    });

    it('with no staff record sees an empty day', async () => {
      const { day } = await setup();
      const other = await ctx.signUp();
      const res = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(other.cookie))
        .expect(200);
      expect(res.body.groups).toEqual([]);
    });
  });

  describe('business scope', () => {
    it("never lists another business's bookings, and answers 404 when cancelling one", async () => {
      const { owner, day } = await setup();
      const stranger = await ctx.signUp();
      const theirs = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(stranger.cookie))
        .expect(200);
      expect(theirs.body.groups).toEqual([]);

      const list = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(owner.cookie));
      const booking = list.body.groups[0].bookings[0];
      await ctx
        .http()
        .post(`/bookings/${booking.id}/cancel`)
        .set(as(stranger.cookie))
        .expect(404);
      await ctx
        .http()
        .post(`/bookings/${randomUUID()}/cancel`)
        .set(as(stranger.cookie))
        .expect(404);
      await ctx
        .http()
        .post('/bookings/not-a-uuid/cancel')
        .set(as(stranger.cookie))
        .expect(404);
      const still = await ctx
        .http()
        .get('/bookings')
        .query({ date: day })
        .set(as(owner.cookie));
      expect(still.body.groups[0].bookings[0].status).toBe('confirmed');
    });

    it('needs a session', async () => {
      await ctx.http().get('/bookings').expect(401);
      await ctx.http().post(`/bookings/${randomUUID()}/cancel`).expect(401);
    });
  });
});
