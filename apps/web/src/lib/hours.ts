import { hhmmToMinutes, type StaffView } from '@slotwise/shared';

type Range = StaffView['hours'][number];

/** "09:00-12:00, 13:00-17:00" for one weekday. */
export function formatDay(hours: Range[], weekday: number): string {
  return hours
    .filter((range) => range.weekday === weekday)
    .map((range) => `${range.start}-${range.end}`)
    .join(', ');
}

/** The reverse of formatDay. Returns the ranges, or an error message naming what to fix. */
export function parseDay(
  text: string,
  weekday: number,
): { ranges: Range[] } | { error: string } {
  const ranges: Range[] = [];
  for (const part of text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const match = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(part);
    const start = match?.[1]?.padStart(5, '0');
    const end = match?.[2]?.padStart(5, '0');
    if (
      !start ||
      !end ||
      hhmmToMinutes(start) === undefined ||
      hhmmToMinutes(end) === undefined
    ) {
      return { error: `"${part}" is not a time range. Use 09:00-17:00.` };
    }
    ranges.push({ weekday, start, end });
  }
  return { ranges };
}
