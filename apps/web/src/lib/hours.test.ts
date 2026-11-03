import { describe, expect, it } from 'vitest';
import { formatDay, parseDay } from './hours';

describe('hours text', () => {
  it('reads several ranges for a day and pads a one-digit hour', () => {
    expect(parseDay('9:00-12:00, 13:00-17:30', 2)).toEqual({
      ranges: [
        { weekday: 2, start: '09:00', end: '12:00' },
        { weekday: 2, start: '13:00', end: '17:30' },
      ],
    });
  });

  it('reads an empty day as no ranges', () => {
    expect(parseDay('  ', 0)).toEqual({ ranges: [] });
  });

  it.each(['9am-5pm', '09:00', '25:00-26:00', '09:00-12:00 13:00-17:00'])(
    'names the part it cannot read: %s',
    (text) => {
      expect(parseDay(text, 0)).toEqual({
        error: expect.stringContaining('time range'),
      });
    },
  );

  it('writes the ranges of one weekday back as text', () => {
    const hours = [
      { weekday: 1, start: '09:00', end: '12:00' },
      { weekday: 3, start: '10:00', end: '11:00' },
    ];
    expect(formatDay(hours, 1)).toBe('09:00-12:00');
    expect(formatDay(hours, 2)).toBe('');
  });
});
