import { DEMO_EMAIL } from '@slotwise/shared';
import { computeSlots, type Busy } from '../slots/slots.js';

export { DEMO_EMAIL };

export const DEMO_SLUG = 'luna-hair-studio';
export const DEMO_BUSINESS = 'Luna Hair Studio';
export const DEMO_TIME_ZONE = 'Asia/Ho_Chi_Minh';

interface HoursSeed {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

const range = (weekdays: number[], start: number, end: number): HoursSeed[] =>
  weekdays.map((weekday) => ({
    weekday,
    startMinute: start * 60,
    endMinute: end * 60,
  }));

// Weekday 0 is Monday.
export const DEMO_STAFF = [
  { name: 'Mai', services: [0, 1, 2, 4], hours: range([1, 2, 3, 4, 5], 9, 18) },
  { name: 'An', services: [0, 2, 3, 4], hours: range([0, 1, 2, 3, 4], 10, 19) },
  {
    name: 'Linh',
    services: [0, 1, 3, 4],
    hours: range([2, 3, 4, 5, 6], 9, 17),
  },
];

export const DEMO_SERVICES = [
  { name: 'Haircut', durationMinutes: 45, priceCents: 3500 },
  { name: 'Colour', durationMinutes: 120, priceCents: 9500 },
  { name: 'Blow-dry', durationMinutes: 30, priceCents: 2500 },
  { name: 'Scalp treatment', durationMinutes: 60, priceCents: 4500 },
  { name: 'Styling', durationMinutes: 45, priceCents: 4000 },
];

const CUSTOMERS = [
  'Ava Tran',
  'Ben Nguyen',
  'Chloe Le',
  'Dan Pham',
  'Emma Vo',
  'Finn Do',
  'Grace Bui',
  'Hugo Dang',
  'Iris Ly',
  'Jack Ngo',
];

export interface SeedBooking {
  staffIndex: number;
  serviceIndex: number;
  start: number;
  end: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

/** A small deterministic random generator, so a reset looks the same each day. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED_DAYS = 14;
const PER_STAFF = [13, 13, 14];

/**
 * About 40 bookings across the next 14 days, relative to `now`: each inside the
 * staff member's working hours, at least an hour ahead, never overlapping.
 */
export function buildSeedBookings(now: number): SeedBooking[] {
  const random = mulberry32(20261102);
  const result: SeedBooking[] = [];

  DEMO_STAFF.forEach((person, staffIndex) => {
    const candidates = computeSlots({
      timeZone: DEMO_TIME_ZONE,
      hours: person.hours,
      busy: [],
      durationMinutes: 30,
      now,
      days: SEED_DAYS,
    });
    const taken: Busy[] = [];
    let attempts = 0;
    while (taken.length < PER_STAFF[staffIndex]! && attempts++ < 500) {
      const start = candidates[Math.floor(random() * candidates.length)]!;
      const serviceIndex =
        person.services[Math.floor(random() * person.services.length)]!;
      const end = start + DEMO_SERVICES[serviceIndex]!.durationMinutes * 60_000;
      // The service must fit inside the day's working hours too.
      const fits = computeSlots({
        timeZone: DEMO_TIME_ZONE,
        hours: person.hours,
        busy: taken,
        durationMinutes: DEMO_SERVICES[serviceIndex]!.durationMinutes,
        now,
        days: SEED_DAYS,
      }).includes(start);
      if (!fits) continue;
      taken.push({ start, end });
      const n = result.length;
      const customerName = CUSTOMERS[n % CUSTOMERS.length]!;
      result.push({
        staffIndex,
        serviceIndex,
        start,
        end,
        customerName,
        customerEmail: `${customerName.toLowerCase().replace(/ /g, '.')}@example.com`,
        customerPhone: `090${String(1000000 + n * 7919).slice(0, 7)}`,
      });
    }
  });
  return result.sort((a, b) => a.start - b.start);
}
