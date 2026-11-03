import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createApp } from './helpers.js';
import { workingHours } from '../src/db/schema.js';

describe('Staff, services and working hours (HTTP)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    ctx = await createApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const as = (cookie: string) => ({ Cookie: cookie });

  describe('staff', () => {
    it('creates, renames and archives a staff member; the archived one stays listed as archived', async () => {
      const owner = await ctx.signUp();
      const created = await ctx
        .http()
        .post('/staff')
        .set(as(owner.cookie))
        .send({ name: 'Mai' })
        .expect(201);
      expect(created.body).toMatchObject({
        name: 'Mai',
        archived: false,
        email: null,
        hours: [],
      });

      await ctx
        .http()
        .patch(`/staff/${created.body.id}`)
        .set(as(owner.cookie))
        .send({ name: 'Mai Tran' })
        .expect(204);
      await ctx
        .http()
        .post(`/staff/${created.body.id}/archive`)
        .set(as(owner.cookie))
        .expect(204);

      const list = await ctx
        .http()
        .get('/staff')
        .set(as(owner.cookie))
        .expect(200);
      expect(list.body).toEqual([
        expect.objectContaining({
          id: created.body.id,
          name: 'Mai Tran',
          archived: true,
        }),
      ]);
    });

    it('can give a staff member a login, and refuses half of one or a taken email', async () => {
      const owner = await ctx.signUp();
      const staff = await ctx.addStaff(owner);
      const me = await ctx
        .http()
        .get('/auth/me')
        .set(as(staff.cookie))
        .expect(200);
      expect(me.body.user).toMatchObject({ email: staff.email, role: 'staff' });

      await ctx
        .http()
        .post('/staff')
        .set(as(owner.cookie))
        .send({ name: 'X', email: 'x@example.com' })
        .expect(400);
      await ctx
        .http()
        .post('/staff')
        .set(as(owner.cookie))
        .send({
          name: 'Y',
          email: staff.email,
          password: 'correct horse battery',
        })
        .expect(409);
    });
  });

  describe('working hours', () => {
    it('keeps several ranges per day, sorted, and replaces them on the next save', async () => {
      const owner = await ctx.signUp();
      const { body: member } = await ctx
        .http()
        .post('/staff')
        .set(as(owner.cookie))
        .send({ name: 'Mai' })
        .expect(201);

      await ctx
        .http()
        .put(`/staff/${member.id}/hours`)
        .set(as(owner.cookie))
        .send({
          ranges: [
            { weekday: 0, start: '13:00', end: '17:00' },
            { weekday: 0, start: '09:00', end: '12:00' },
            { weekday: 2, start: '10:00', end: '18:30' },
          ],
        })
        .expect(204);
      const first = await ctx.http().get('/staff').set(as(owner.cookie));
      expect(first.body[0].hours).toEqual([
        { weekday: 0, start: '09:00', end: '12:00' },
        { weekday: 0, start: '13:00', end: '17:00' },
        { weekday: 2, start: '10:00', end: '18:30' },
      ]);

      await ctx
        .http()
        .put(`/staff/${member.id}/hours`)
        .set(as(owner.cookie))
        .send({ ranges: [] })
        .expect(204);
      const rows = await ctx.database.db
        .select()
        .from(workingHours)
        .where(eq(workingHours.staffId, member.id));
      expect(rows).toHaveLength(0);
    });

    it.each([
      [
        'an end before the start',
        [{ weekday: 1, start: '12:00', end: '09:00' }],
      ],
      [
        'overlapping ranges',
        [
          { weekday: 1, start: '09:00', end: '12:00' },
          { weekday: 1, start: '11:00', end: '13:00' },
        ],
      ],
      ['a bad time', [{ weekday: 1, start: '9am', end: '12:00' }]],
      [
        'a weekday out of range',
        [{ weekday: 7, start: '09:00', end: '12:00' }],
      ],
    ])('rejects %s with 400 and keeps the old hours', async (_name, ranges) => {
      const owner = await ctx.signUp();
      const { body: member } = await ctx
        .http()
        .post('/staff')
        .set(as(owner.cookie))
        .send({ name: 'Mai' })
        .expect(201);
      await ctx
        .http()
        .put(`/staff/${member.id}/hours`)
        .set(as(owner.cookie))
        .send({ ranges: [{ weekday: 0, start: '09:00', end: '10:00' }] })
        .expect(204);
      await ctx
        .http()
        .put(`/staff/${member.id}/hours`)
        .set(as(owner.cookie))
        .send({ ranges })
        .expect(400);
      const list = await ctx.http().get('/staff').set(as(owner.cookie));
      expect(list.body[0].hours).toHaveLength(1);
    });
  });

  describe('services', () => {
    it('creates, edits and archives a service and links the staff who perform it', async () => {
      const owner = await ctx.signUp();
      const { body: mai } = await ctx
        .http()
        .post('/staff')
        .set(as(owner.cookie))
        .send({ name: 'Mai' })
        .expect(201);
      const { body: an } = await ctx
        .http()
        .post('/staff')
        .set(as(owner.cookie))
        .send({ name: 'An' })
        .expect(201);

      const created = await ctx
        .http()
        .post('/services')
        .set(as(owner.cookie))
        .send({ name: 'Haircut', durationMinutes: 45, priceCents: 3500 })
        .expect(201);
      expect(created.body).toMatchObject({
        name: 'Haircut',
        durationMinutes: 45,
        priceCents: 3500,
        archived: false,
        staffIds: [],
      });
      const id = created.body.id;

      await ctx
        .http()
        .patch(`/services/${id}`)
        .set(as(owner.cookie))
        .send({ name: 'Cut and style', durationMinutes: 60, priceCents: 4500 })
        .expect(204);
      await ctx
        .http()
        .put(`/services/${id}/staff`)
        .set(as(owner.cookie))
        .send({ staffIds: [mai.id, an.id, mai.id] })
        .expect(204);
      let list = await ctx.http().get('/services').set(as(owner.cookie));
      expect(list.body[0]).toMatchObject({
        name: 'Cut and style',
        durationMinutes: 60,
        priceCents: 4500,
      });
      expect([...list.body[0].staffIds].sort()).toEqual([mai.id, an.id].sort());

      await ctx
        .http()
        .put(`/services/${id}/staff`)
        .set(as(owner.cookie))
        .send({ staffIds: [an.id] })
        .expect(204);
      await ctx
        .http()
        .post(`/services/${id}/archive`)
        .set(as(owner.cookie))
        .expect(204);
      list = await ctx.http().get('/services').set(as(owner.cookie));
      expect(list.body[0]).toMatchObject({ archived: true, staffIds: [an.id] });
    });

    it.each([
      [
        'a duration off the 15-minute grid',
        { name: 'X', durationMinutes: 50, priceCents: 1 },
      ],
      ['a negative price', { name: 'X', durationMinutes: 30, priceCents: -1 }],
      ['no name', { name: ' ', durationMinutes: 30, priceCents: 1 }],
    ])('rejects %s with 400', async (_name, body) => {
      const owner = await ctx.signUp();
      await ctx
        .http()
        .post('/services')
        .set(as(owner.cookie))
        .send(body)
        .expect(400);
    });
  });

  describe('roles', () => {
    it('refuses a staff user on every management endpoint with 403, and a visitor with 401', async () => {
      const owner = await ctx.signUp();
      const staff = await ctx.addStaff(owner);
      const { body: service } = await ctx
        .http()
        .post('/services')
        .set(as(owner.cookie))
        .send({ name: 'S', durationMinutes: 30, priceCents: 0 })
        .expect(201);
      const calls = [
        (r: ReturnType<typeof ctx.http>) => r.get('/staff'),
        (r: ReturnType<typeof ctx.http>) =>
          r.post('/staff').send({ name: 'Z' }),
        (r: ReturnType<typeof ctx.http>) =>
          r.patch(`/staff/${staff.id}`).send({ name: 'Z' }),
        (r: ReturnType<typeof ctx.http>) =>
          r.post(`/staff/${staff.id}/archive`),
        (r: ReturnType<typeof ctx.http>) =>
          r.put(`/staff/${staff.id}/hours`).send({ ranges: [] }),
        (r: ReturnType<typeof ctx.http>) => r.get('/services'),
        (r: ReturnType<typeof ctx.http>) =>
          r
            .post('/services')
            .send({ name: 'Z', durationMinutes: 30, priceCents: 0 }),
        (r: ReturnType<typeof ctx.http>) =>
          r
            .patch(`/services/${service.id}`)
            .send({ name: 'Z', durationMinutes: 30, priceCents: 0 }),
        (r: ReturnType<typeof ctx.http>) =>
          r.post(`/services/${service.id}/archive`),
        (r: ReturnType<typeof ctx.http>) =>
          r.put(`/services/${service.id}/staff`).send({ staffIds: [] }),
      ];
      for (const call of calls) {
        await call(ctx.http()).set(as(staff.cookie)).expect(403);
        await call(ctx.http()).expect(401);
      }
    });
  });

  describe('business scope', () => {
    it("answers 404 for another business's staff and services, and never changes them", async () => {
      const mine = await ctx.signUp();
      const theirs = await ctx.signUp();
      const { body: theirStaff } = await ctx
        .http()
        .post('/staff')
        .set(as(theirs.cookie))
        .send({ name: 'Theirs' })
        .expect(201);
      const { body: theirService } = await ctx
        .http()
        .post('/services')
        .set(as(theirs.cookie))
        .send({ name: 'Theirs', durationMinutes: 30, priceCents: 100 })
        .expect(201);
      const { body: myStaff } = await ctx
        .http()
        .post('/staff')
        .set(as(mine.cookie))
        .send({ name: 'Mine' })
        .expect(201);

      const hours = { ranges: [{ weekday: 0, start: '09:00', end: '10:00' }] };
      await ctx
        .http()
        .patch(`/staff/${theirStaff.id}`)
        .set(as(mine.cookie))
        .send({ name: 'Hacked' })
        .expect(404);
      await ctx
        .http()
        .post(`/staff/${theirStaff.id}/archive`)
        .set(as(mine.cookie))
        .expect(404);
      await ctx
        .http()
        .put(`/staff/${theirStaff.id}/hours`)
        .set(as(mine.cookie))
        .send(hours)
        .expect(404);
      await ctx
        .http()
        .patch(`/services/${theirService.id}`)
        .set(as(mine.cookie))
        .send({ name: 'Hacked', durationMinutes: 30, priceCents: 1 })
        .expect(404);
      await ctx
        .http()
        .post(`/services/${theirService.id}/archive`)
        .set(as(mine.cookie))
        .expect(404);
      await ctx
        .http()
        .put(`/services/${theirService.id}/staff`)
        .set(as(mine.cookie))
        .send({ staffIds: [] })
        .expect(404);
      // my service cannot be linked to their staff member
      const { body: myService } = await ctx
        .http()
        .post('/services')
        .set(as(mine.cookie))
        .send({ name: 'Mine', durationMinutes: 30, priceCents: 100 })
        .expect(201);
      await ctx
        .http()
        .put(`/services/${myService.id}/staff`)
        .set(as(mine.cookie))
        .send({ staffIds: [myStaff.id, theirStaff.id] })
        .expect(404);
      await ctx
        .http()
        .patch(`/staff/${randomUUID()}`)
        .set(as(mine.cookie))
        .send({ name: 'x' })
        .expect(404);
      await ctx
        .http()
        .patch('/staff/not-a-uuid')
        .set(as(mine.cookie))
        .send({ name: 'x' })
        .expect(404);

      const list = await ctx.http().get('/staff').set(as(mine.cookie));
      expect(list.body.map((s: { name: string }) => s.name)).toEqual(['Mine']);
      const theirsAfter = await ctx.http().get('/staff').set(as(theirs.cookie));
      expect(theirsAfter.body[0]).toMatchObject({
        name: 'Theirs',
        archived: false,
        hours: [],
      });
      const links = await ctx.http().get('/services').set(as(mine.cookie));
      expect(links.body[0].staffIds).toEqual([]);
    });
  });
});
