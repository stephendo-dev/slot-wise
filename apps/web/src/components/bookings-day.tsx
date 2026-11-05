'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DayBookings } from '@slotwise/shared';
import { formatTime } from '@/lib/format';
import { Alert, Card, smallButton, useMutation } from './manager-ui';

export function DateForm({ date }: { date: string }) {
  const router = useRouter();
  const [value, setValue] = useState(date);
  return (
    <form
      className="flex items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (value) router.push(`/dashboard/bookings?date=${value}`);
      }}
    >
      <div>
        <label htmlFor="date" className="block text-sm font-medium">
          Day
        </label>
        <input
          id="date"
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-2"
        />
      </div>
      <button type="submit" className={smallButton}>
        Show
      </button>
    </form>
  );
}

export function BookingsDay({
  day,
  canCancel,
}: {
  day: DayBookings;
  canCancel: boolean;
}) {
  const { run, message, busy } = useMutation();

  return (
    <div className="mt-8 space-y-6">
      <Alert message={message} />
      {day.groups.length === 0 ? (
        <p className="text-slate-600">Nothing to show for this day.</p>
      ) : null}
      {day.groups.map((group) => (
        <section key={group.staffId} aria-labelledby={`staff-${group.staffId}`}>
          <h2 id={`staff-${group.staffId}`} className="text-lg font-medium">
            {group.staffName}
          </h2>
          <ul className="mt-2 space-y-2">
            {group.bookings.map((booking) => (
              <Card key={booking.id}>
                <div className="flex items-start justify-between gap-4">
                  <div
                    className={
                      booking.status === 'cancelled'
                        ? 'text-slate-500 line-through'
                        : ''
                    }
                  >
                    <p className="font-medium">
                      {formatTime(booking.start, day.timeZone)} to{' '}
                      {formatTime(booking.end, day.timeZone)} ·{' '}
                      {booking.service}
                    </p>
                    <p className="text-sm">
                      {booking.customerName} · {booking.customerPhone} ·{' '}
                      {booking.customerEmail}
                    </p>
                  </div>
                  {booking.status === 'cancelled' ? (
                    <span className="text-sm text-slate-600">Cancelled</span>
                  ) : canCancel ? (
                    <button
                      type="button"
                      className={smallButton}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Cancel ${booking.customerName}'s booking?`,
                          )
                        ) {
                          void run('POST', `/bookings/${booking.id}/cancel`);
                        }
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </Card>
            ))}
            {group.bookings.length === 0 ? (
              <li className="text-sm text-slate-600">No bookings.</li>
            ) : null}
          </ul>
        </section>
      ))}
    </div>
  );
}
