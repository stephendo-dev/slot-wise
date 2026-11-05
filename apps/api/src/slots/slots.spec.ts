import { chooseStaff, computeSlots, wallToUtc } from './slots.js';

const MIN = 60_000;
const HOUR = 60 * MIN;

function local(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

const VN = 'Asia/Ho_Chi_Minh'; // UTC+7, no daylight saving
// 2026-11-02 is a Monday (weekday 0). 01:00Z is 08:00 local, an hour before opening.
const NOW = Date.parse('2026-11-02T01:00:00Z');
const monday = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return { weekday: 0, startMinute: sh! * 60 + sm!, endMinute: eh! * 60 + em! };
};

function mondaySlots(
  overrides: Partial<Parameters<typeof computeSlots>[0]> = {},
) {
  return computeSlots({
    timeZone: VN,
    hours: [monday('09:00', '17:00')],
    busy: [],
    durationMinutes: 60,
    now: NOW,
    ...overrides,
  }).filter((ms) => local(ms, VN).startsWith('2026-11-02'));
}

describe('computeSlots', () => {
  it('starts on a 15-minute grid inside working hours, and the whole service fits', () => {
    const slots = mondaySlots().map((ms) => local(ms, VN).slice(11));
    expect(slots[0]).toBe('09:00');
    expect(slots.at(-1)).toBe('16:00');
    expect(slots).toHaveLength(29);
    expect(slots.every((s) => Number(s.slice(3)) % 15 === 0)).toBe(true);
  });

  it('keeps a long service from starting too late', () => {
    const slots = mondaySlots({ durationMinutes: 90 }).map((ms) =>
      local(ms, VN).slice(11),
    );
    expect(slots.at(-1)).toBe('15:30');
  });

  it('removes starts that overlap a confirmed booking and keeps those that only touch it', () => {
    const start = wallToUtc(2026, 11, 2, 10 * 60, VN)!;
    const slots = mondaySlots({ busy: [{ start, end: start + HOUR }] }).map(
      (ms) => local(ms, VN).slice(11),
    );
    expect(slots).toContain('09:00'); // ends exactly when the booking starts
    expect(slots).not.toContain('09:15');
    expect(slots).not.toContain('10:45');
    expect(slots).toContain('11:00'); // starts exactly when the booking ends
  });

  it('needs at least one hour of notice', () => {
    const now = wallToUtc(2026, 11, 2, 8 * 60 + 30, VN)!;
    const slots = mondaySlots({ now }).map((ms) => local(ms, VN).slice(11));
    expect(slots[0]).toBe('09:30');
  });

  it('offers nothing in the past or after the last day', () => {
    const now = wallToUtc(2026, 11, 2, 18 * 60, VN)!;
    expect(mondaySlots({ now })).toEqual([]);
    const all = computeSlots({
      timeZone: VN,
      hours: [monday('09:00', '10:00')],
      busy: [],
      durationMinutes: 60,
      now: NOW,
    });
    // Mondays within 30 days of 2 Nov: 2, 9, 16, 23, 30 Nov (Dec 7 is day 35)
    expect(all.map((ms) => local(ms, VN).slice(0, 10))).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
  });

  it('handles several ranges in one day', () => {
    const slots = mondaySlots({
      hours: [monday('09:00', '10:00'), monday('13:00', '14:00')],
    }).map((ms) => local(ms, VN).slice(11));
    expect(slots).toEqual(['09:00', '13:00']);
  });

  it('works in the business time zone, not the server one', () => {
    const NY = 'America/New_York';
    // 2026-11-02 09:00 in New York (UTC-5 after the 1 Nov change) is 14:00Z.
    const now = Date.parse('2026-11-02T10:00:00Z');
    const slots = computeSlots({
      timeZone: NY,
      hours: [monday('09:00', '10:00')],
      busy: [],
      durationMinutes: 60,
      now,
    });
    expect(slots[0]).toBe(Date.parse('2026-11-02T14:00:00Z'));
  });

  describe('daylight saving', () => {
    const NY = 'America/New_York';
    const sunday = (start: string, end: string) => ({
      ...monday(start, end),
      weekday: 6,
    });

    it('skips the hour that does not exist on the spring-forward day', () => {
      // Sunday 8 March 2026: 02:00 jumps to 03:00. The day has 3 real hours between 01:00 and 05:00.
      const slots = computeSlots({
        timeZone: NY,
        hours: [sunday('01:00', '05:00')],
        busy: [],
        durationMinutes: 60,
        now: Date.parse('2026-03-02T00:00:00Z'),
      }).filter((ms) => local(ms, NY).startsWith('2026-03-08'));
      const times = slots.map((ms) => local(ms, NY).slice(11));
      expect(times.some((t) => t.startsWith('02:'))).toBe(false);
      expect(times[0]).toBe('01:00');
      expect(times).toContain('03:00');
      expect(times.at(-1)).toBe('04:00');
      expect(times).toHaveLength(9);
    });

    it('offers each wall time once on the fall-back day and never runs past closing', () => {
      // Sunday 1 November 2026: 02:00 goes back to 01:00, so 01:00-01:59 happens twice.
      const slots = computeSlots({
        timeZone: NY,
        hours: [sunday('00:30', '03:30')],
        busy: [],
        durationMinutes: 30,
        now: Date.parse('2026-10-26T00:00:00Z'),
      }).filter((ms) => local(ms, NY).startsWith('2026-11-01'));
      expect(new Set(slots).size).toBe(slots.length);
      expect([...slots].sort((a, b) => a - b)).toEqual(slots);
      const closing = wallToUtc(2026, 11, 1, 3 * 60 + 30, NY)!;
      expect(slots.every((ms) => ms + 30 * MIN <= closing)).toBe(true);
      expect(local(slots[0]!, NY).slice(11)).toBe('00:30');
    });
  });
});

describe('wallToUtc', () => {
  it('returns undefined for a wall time that does not exist', () => {
    expect(
      wallToUtc(2026, 3, 8, 2 * 60 + 30, 'America/New_York'),
    ).toBeUndefined();
  });

  it('converts an ordinary wall time', () => {
    expect(wallToUtc(2026, 11, 2, 9 * 60, 'Asia/Ho_Chi_Minh')).toBe(
      Date.parse('2026-11-02T02:00:00Z'),
    );
  });
});

describe('chooseStaff', () => {
  it('picks the staff member with the fewest bookings that day', () => {
    expect(
      chooseStaff([
        { staffId: 'a', bookingsThatDay: 3 },
        { staffId: 'b', bookingsThatDay: 1 },
        { staffId: 'c', bookingsThatDay: 2 },
      ]),
    ).toBe('b');
  });

  it('breaks a tie by staff id, so the answer is stable', () => {
    expect(
      chooseStaff([
        { staffId: 'b', bookingsThatDay: 1 },
        { staffId: 'a', bookingsThatDay: 1 },
      ]),
    ).toBe('a');
  });

  it('has no answer without candidates', () => {
    expect(chooseStaff([])).toBeUndefined();
  });
});
