import { describe, expect, it } from 'vitest';
import { formatTime, groupByDay } from './format';

describe('slot formatting', () => {
  it('shows a time in the business zone, not the server one', () => {
    expect(formatTime('2026-11-02T02:00:00.000Z', 'Asia/Ho_Chi_Minh')).toBe(
      '09:00',
    );
    expect(formatTime('2026-11-02T14:00:00.000Z', 'America/New_York')).toBe(
      '09:00',
    );
  });

  it('groups slots by the local day, so a late slot stays on its own day', () => {
    // 18:00Z is 01:00 the next day in Vietnam.
    const groups = groupByDay(
      [
        '2026-11-02T02:00:00.000Z',
        '2026-11-02T03:00:00.000Z',
        '2026-11-02T18:00:00.000Z',
      ],
      'Asia/Ho_Chi_Minh',
    );
    expect(groups.map((g) => g.slots.length)).toEqual([2, 1]);
    expect(groups[0]!.day).toContain('Mon');
    expect(groups[1]!.day).toContain('Tue');
  });
});
