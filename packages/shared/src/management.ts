import { z } from 'zod';

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** "09:30" to minutes after midnight, or undefined when it is not a time of day. */
export function hhmmToMinutes(value: string): number | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

export function minutesToHhmm(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

const name = z.string().trim().min(1, 'Enter a name').max(80);

export const staffCreateSchema = z
  .object({
    name,
    email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(128)
      .optional(),
  })
  .refine((value) => !value.email === !value.password, {
    message: 'Give both an email and a password for a staff login, or neither',
    path: ['email'],
  });
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;

export const staffUpdateSchema = z.object({ name });
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

export const serviceSchema = z.object({
  name,
  durationMinutes: z.number().int().min(15).max(480).multipleOf(15),
  priceCents: z.number().int().min(0).max(10_000_000),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export const serviceStaffSchema = z.object({
  staffIds: z.array(z.uuid()).max(100),
});
export type ServiceStaffInput = z.infer<typeof serviceStaffSchema>;

const timeOfDay = z
  .string()
  .refine((value) => hhmmToMinutes(value) !== undefined, 'Use HH:MM');

export const hoursSchema = z
  .object({
    ranges: z
      .array(
        z.object({
          weekday: z.number().int().min(0).max(6),
          start: timeOfDay,
          end: timeOfDay,
        }),
      )
      .max(70),
  })
  .superRefine(({ ranges }, ctx) => {
    const byDay = new Map<number, [number, number][]>();
    ranges.forEach((range, index) => {
      const start = hhmmToMinutes(range.start);
      const end = hhmmToMinutes(range.end);
      if (start === undefined || end === undefined) return;
      if (start >= end) {
        ctx.addIssue({
          code: 'custom',
          message: 'The end must be after the start',
          path: ['ranges', index, 'end'],
        });
        return;
      }
      const day = byDay.get(range.weekday) ?? [];
      if (day.some(([s, e]) => start < e && end > s)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Ranges on one day must not overlap',
          path: ['ranges', index, 'start'],
        });
      }
      day.push([start, end]);
      byDay.set(range.weekday, day);
    });
  });
export type HoursInput = z.infer<typeof hoursSchema>;

export interface StaffView {
  id: string;
  name: string;
  email: string | null;
  archived: boolean;
  hours: { weekday: number; start: string; end: string }[];
}

export interface ServiceView {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  archived: boolean;
  staffIds: string[];
}
