import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { DayBookings } from '@slotwise/shared';
import { BookingsDay, DateForm } from '@/components/bookings-day';
import { apiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Bookings',
  robots: { index: false },
};

export default function BookingsPage({
  searchParams,
}: PageProps<'/dashboard/bookings'>) {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
      <Suspense fallback={<p className="mt-6 text-slate-600">Loading…</p>}>
        <Bookings searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Bookings({
  searchParams,
}: {
  searchParams: PageProps<'/dashboard/bookings'>['searchParams'];
}) {
  const { date } = await searchParams;
  const chosen =
    typeof date === 'string' ? `?date=${encodeURIComponent(date)}` : '';
  const [session, day] = await Promise.all([
    getSession(),
    apiGet<DayBookings>(`/bookings${chosen}`),
  ]);
  return (
    <div className="mt-6">
      <DateForm key={day.date} date={day.date} />
      <BookingsDay day={day} canCancel={session?.user.role === 'owner'} />
    </div>
  );
}
