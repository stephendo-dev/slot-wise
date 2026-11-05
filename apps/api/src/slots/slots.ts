// The slot rules, with no database: working hours, busy times, a duration, the
// time now and a time zone in, start times out. Times are epoch milliseconds.

const MINUTE = 60_000;
const GRID_MINUTES = 15;
const LEAD_MS = 60 * MINUTE;
const DEFAULT_DAYS = 30;

export interface HoursRange {
  /** 0 is Monday. */
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface Busy {
  start: number;
  end: number;
}

export interface SlotInput {
  timeZone: string;
  hours: HoursRange[];
  /** Confirmed bookings of the staff member. */
  busy: Busy[];
  durationMinutes: number;
  now: number;
  days?: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsOf(ms: number, timeZone: string) {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, format);
  }
  const value = (type: string) =>
    Number(format.formatToParts(ms).find((part) => part.type === type)!.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

/** How far the zone's wall clock is ahead of UTC at an instant. */
function offsetAt(ms: number, timeZone: string): number {
  const p = partsOf(ms, timeZone);
  const wallAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return wallAsUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * The instant at which the zone's wall clock reads `minute` minutes after
 * midnight on y-m-d. Undefined when that wall time does not exist (the hour
 * skipped by daylight saving). When it happens twice, the first time wins.
 */
export function wallToUtc(
  year: number,
  month: number,
  day: number,
  minute: number,
  timeZone: string,
): number | undefined {
  const wall = Date.UTC(year, month - 1, day, 0, minute);
  let guess = wall - offsetAt(wall, timeZone);
  guess = wall - offsetAt(guess, timeZone);
  const back = partsOf(guess, timeZone);
  const matches =
    back.year === year &&
    back.month === month &&
    back.day === day &&
    back.hour * 60 + back.minute === minute;
  if (matches) return guess;
  // Near a fall-back change the second guess can land on the later of two matches; try the earlier.
  const earlier = wall - offsetAt(guess - 3_600_000, timeZone);
  const check = partsOf(earlier, timeZone);
  return check.year === year &&
    check.month === month &&
    check.day === day &&
    check.hour * 60 + check.minute === minute
    ? earlier
    : undefined;
}

/** Start times (epoch ms, ascending) at which a service can be booked for one staff member. */
export function computeSlots(input: SlotInput): number[] {
  const { timeZone, durationMinutes, now } = input;
  const days = input.days ?? DEFAULT_DAYS;
  const durationMs = durationMinutes * MINUTE;
  const earliest = now + LEAD_MS;
  const today = partsOf(now, timeZone);
  const slots: number[] = [];

  for (let offset = 0; offset < days; offset++) {
    const date = new Date(
      Date.UTC(today.year, today.month - 1, today.day + offset),
    );
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const weekday = (date.getUTCDay() + 6) % 7;

    for (const range of input.hours) {
      if (range.weekday !== weekday) continue;
      const closing = wallToUtc(year, month, day, range.endMinute, timeZone);
      if (closing === undefined) continue;
      const first = Math.ceil(range.startMinute / GRID_MINUTES) * GRID_MINUTES;
      for (
        let minute = first;
        minute < range.endMinute;
        minute += GRID_MINUTES
      ) {
        const start = wallToUtc(year, month, day, minute, timeZone);
        if (start === undefined || start < earliest) continue;
        const end = start + durationMs;
        if (end > closing) continue;
        if (input.busy.some((busy) => start < busy.end && end > busy.start))
          continue;
        slots.push(start);
      }
    }
  }
  return slots.sort((a, b) => a - b);
}

export interface StaffLoad {
  staffId: string;
  bookingsThatDay: number;
}

/** For "anyone": the free staff member with the fewest bookings that day; ties go to the lower id. */
export function chooseStaff(candidates: StaffLoad[]): string | undefined {
  return [...candidates].sort(
    (a, b) =>
      a.bookingsThatDay - b.bookingsThatDay ||
      a.staffId.localeCompare(b.staffId),
  )[0]?.staffId;
}

/** The local calendar day (y-m-d) of an instant, for counting a day's bookings. */
export function localDay(ms: number, timeZone: string): string {
  const p = partsOf(ms, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
