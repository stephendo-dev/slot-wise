import {
  buildSeedBookings,
  DEMO_SERVICES,
  DEMO_STAFF,
  DEMO_TIME_ZONE,
  SEED_DAYS,
} from './demo-seed.js';
import { computeSlots } from '../slots/slots.js';

describe('buildSeedBookings', () => {
  const now = Date.parse('2026-11-02T03:00:00Z');
  const seed = buildSeedBookings(now);

  it('makes about 40 bookings across the next 14 days, all ahead of now', () => {
    expect(seed.length).toBeGreaterThanOrEqual(38);
    expect(seed.length).toBeLessThanOrEqual(42);
    expect(seed.every((b) => b.start >= now + 3600_000)).toBe(true);
    expect(
      seed.every((b) => b.start < now + (SEED_DAYS + 1) * 24 * 3600_000),
    ).toBe(true);
  });

  it('never double-books a staff member, and keeps every booking inside working hours', () => {
    for (const [staffIndex, person] of DEMO_STAFF.entries()) {
      const mine = seed
        .filter((b) => b.staffIndex === staffIndex)
        .sort((a, b) => a.start - b.start);
      for (let i = 1; i < mine.length; i++)
        expect(mine[i]!.start).toBeGreaterThanOrEqual(mine[i - 1]!.end);
      for (const booking of mine) {
        const duration = DEMO_SERVICES[booking.serviceIndex]!.durationMinutes;
        expect(person.services).toContain(booking.serviceIndex);
        const free = computeSlots({
          timeZone: DEMO_TIME_ZONE,
          hours: person.hours,
          busy: [],
          durationMinutes: duration,
          now,
          days: SEED_DAYS,
        });
        expect(free).toContain(booking.start);
      }
    }
  });

  it('is the same for the same day, so a reset looks the same each time', () => {
    expect(buildSeedBookings(now)).toEqual(seed);
  });

  it('moves with the date: tomorrow starts later', () => {
    const later = buildSeedBookings(now + 24 * 3600_000);
    expect(later[0]!.start).toBeGreaterThan(seed[0]!.start);
  });
});
