import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false },
};

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <Suspense
        fallback={<p className="text-slate-600">Loading your dashboard…</p>}
      >
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const session = await getSession();
  if (!session) redirect('/login');
  const { business, user } = session;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome, {business.name}
      </h1>
      <p className="mt-1 text-slate-700">
        Signed in as {user.email} ({user.role}). Your booking page will be{' '}
        <code>/b/{business.slug}</code>.
      </p>
      <p className="mt-8 rounded-md border border-dashed border-slate-300 p-6 text-slate-700">
        Add your staff and services under Staff and Services. Bookings arrive in
        the next steps.
      </p>
    </>
  );
}
