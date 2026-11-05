import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { BookingSummary } from '@slotwise/shared';
import { CancelBooking } from '@/components/cancel-booking';
import { formatDay, formatTime } from '@/lib/format';
import { publicGet } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Your booking',
  robots: { index: false },
};

export default function BookingConfirmationPage({
  params,
}: PageProps<'/booking/[token]'>) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Suspense fallback={<p className="text-slate-600">Loading…</p>}>
        <Booking params={params} />
      </Suspense>
    </main>
  );
}

async function Booking({
  params,
}: {
  params: PageProps<'/booking/[token]'>['params'];
}) {
  const { token } = await params;
  const booking = await publicGet<BookingSummary>(
    `/bookings/${encodeURIComponent(token)}`,
  );
  const cancelled = booking.status === 'cancelled';

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {cancelled ? 'Booking cancelled' : 'Booking confirmed'}
      </h1>
      <dl className="mt-6 grid grid-cols-[8rem_1fr] gap-y-2">
        <dt className="text-slate-600">Business</dt>
        <dd>{booking.business}</dd>
        <dt className="text-slate-600">Service</dt>
        <dd>{booking.service}</dd>
        <dt className="text-slate-600">With</dt>
        <dd>{booking.staff}</dd>
        <dt className="text-slate-600">Date</dt>
        <dd>{formatDay(booking.start, booking.timeZone)}</dd>
        <dt className="text-slate-600">Time</dt>
        <dd>
          {formatTime(booking.start, booking.timeZone)} to{' '}
          {formatTime(booking.end, booking.timeZone)} ({booking.timeZone})
        </dd>
      </dl>
      <p className="mt-6 text-sm text-slate-600">
        Keep this page&apos;s address. It is your private link to view or cancel
        the booking.
      </p>
      {cancelled ? null : <CancelBooking token={token} />}
    </>
  );
}
